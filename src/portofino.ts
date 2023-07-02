import jwt_decode from 'jwt-decode';
import {catchError, from, map, mergeMap, Observable, of, ReplaySubject, tap} from "rxjs";
import {HttpClient, RequestInterceptor, ResponseInterceptor} from "./httpClient";
import {Authenticator, NO_AUTH_HEADER} from "./auth";

interface Operation {
    signature: string;
    name: string;
    available: boolean;
    invoke: (config: RequestInit) => Observable<Response>;
}

export class ResourceAction {
    public operations: { [name: string]: Operation } = {};

    constructor(
        protected url: string, protected parent: ResourceAction,
        public http: HttpClient = parent.http) {
    }

    refresh(): Observable<this> {
        const resource = this;
        return this.http.get(this.url + "/:operations").pipe(
            mergeMap(v => from(v.json())),
            map((ops: Operation[]) => {
                for (const op in resource.operations) {
                    delete resource[op];
                }
                resource.operations = {};
                ops.forEach(op => resource.installOperation(op));
                return resource;
            }));
    }

    protected proxy<T extends ResourceAction>(observable: Observable<T>) {
        const subject = new ReplaySubject<T>(1);
        observable.subscribe(subject);
        const self = this;
        if (typeof Proxy === "function") {
            return new Proxy(subject, {
                get(target, p: string | symbol, receiver: any): any {
                    if (p === "get") {
                        return (...args: any[]) => self.proxy(
                            subject.pipe(mergeMap(r => r.get.apply(r, args))) as Observable<any>);
                    } else if(p === "operations") {
                        return subject.pipe(map(r => r.operations));
                    } else if(self.isProxyProperty(p)) {
                        return self.proxy(subject.pipe(mergeMap(r => {
                            return r[p] as Observable<any>
                        })));
                    } else if(p in subject || p === "operator" || p === "source") { // RxJS members
                        return subject[p];
                    } else {
                        return (...args: any[]) => subject.pipe(mergeMap(r => r[p].apply(r, args)));
                    }
                }
            });
        } else {
            return subject;
        }
    }

    protected isProxyProperty(name: string | symbol): boolean {
        return false;
    }

    get(segment: string, type: new (...args) => ResourceAction = ResourceAction, proxy = true) {
        if (segment.startsWith("/")) {
            return this.root.get(segment);
        } else {
            const action = new type(this.url + "/" + segment, this).refresh();
            if (proxy) {
                return this.proxy(action);
            } else {
                return action;
            }
        }
    }

    get root() {
        return this.parent.root;
    }

    protected installOperation(op: Operation) {
        if (!op.signature) {
            return;
        }
        const definition = op.signature.split(" ");
        const method = definition[0].toLowerCase();
        let path: string;
        const pathParams: string[] = [];
        if (definition.length > 1) {
            path = definition[1];
            for (const pathParam of path.matchAll(/\{.*?}/g)) {
                pathParams.push(pathParam[0]);
            }
        } else {
            path = "";
        }
        const operationFunction = (...args) => {
            let config = {};
            if (args.length == pathParams.length + 1) {
                config = args[pathParams.length];
                args = args.slice(0, pathParams.length);
            }
            if (args.length <= pathParams.length) {
                for (let i = 0; i < args.length; i++) {
                    path = path.replace(pathParams[i], args[i]);
                }
            } else {
                throw "Too many path params, expected " + pathParams.length + ", got " + args.length;
            }
            return this.http[method](this.url + "/" + path, config);
        }
        let name;
        if (this[op.name]) {
            name = "op_" + op.name;
        } else {
            name = op.name;
        }
        this[name] = operationFunction;
        operationFunction.available = op.available;
        op.invoke = operationFunction;
        this.operations[name] = op;
    }
}

export interface TokenStorage {
    get(): Observable<string | undefined>;
    set(value: string): void;
    unset(): void;
}

export class SimpleTokenStorage implements TokenStorage {
    constructor(protected token?: string) {}

    get(): Observable<string | undefined> {
        return of(this.token);
    }

    set(value: string): void {
        this.token = value;
    }

    unset(): void {
        this.token = undefined;
    }
}

export class Portofino extends ResourceAction {
    public auth: Observable<ResourceAction> | ResourceAction;
    public upstairs: Observable<Upstairs> | Upstairs;

    public tokenExpirationThresholdMs = 10 * 60 * 1000; //Ten minutes before the token expires, refresh it
    protected token?: string;
    protected decodedToken?: any;

    constructor(url: string, protected authenticator?: Authenticator,
                protected tokenStorage: TokenStorage = new SimpleTokenStorage()) {
        super(url, null, new HttpClient());
        const self = this;
        tokenStorage.get().subscribe(tk => this.setToken(tk));
        const credentialsInterceptor: RequestInterceptor = {
            intercept(request) {
                if (self.token && !request.headers.has(NO_AUTH_HEADER)) {
                    request.headers.set("Authorization", "Bearer " + self.token);
                }
                return request;
            }
        };
        const authInterceptor: ResponseInterceptor = {
            intercept(request, response) {
                if (self.authenticator) {
                    if (response.status === 401) {
                        self.setToken(null);
                        return self.authenticator.authenticate(request, self.auth).pipe(
                            mergeMap(userInfo => {
                                self.setToken(userInfo.jwt);
                                return self.http.request(request);
                            }));
                    } else {
                        const tokenExpiration = self.decodedToken?.exp;
                        if(tokenExpiration &&
                            Date.now() < tokenExpiration * 1000 &&
                            Date.now() > tokenExpiration * 1000 - self.tokenExpirationThresholdMs) {
                            self.authenticator.refresh(self.auth).subscribe({
                                next(refreshResp) {
                                    if (refreshResp.ok) {
                                        refreshResp.text().then(token => self.setToken(token));
                                    }
                                },
                                error() {
                                    // TODO notify error "Failed to refresh access token"
                                }
                            });
                        }
                    }
                }
                return of(response);
            }
        };
        this.http.requestInterceptors = [credentialsInterceptor];
        this.http.responseInterceptors = [authInterceptor];
    }

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            this.decodedToken = jwt_decode(token);
            this.tokenStorage.set(token);
        } else {
            this.decodedToken = null;
            this.tokenStorage.unset();
        }
    }

    static connect(url, authenticator: Authenticator) {
        const portofino = new Portofino(url, authenticator);
        return portofino.proxy(portofino.refresh());
    }

    get(segment: string, type: new (...args) => ResourceAction = ResourceAction, proxy = true) {
        if (!segment.startsWith("/")) {
            segment = "/" + segment;
        }
        const action = new type(this.url + segment, this).refresh();
        if (proxy) {
            return this.proxy(action);
        } else {
            return action;
        }
    }

    get root() {
        return this;
    }

    refresh(): Observable<this> {
        const self = this;
        return super.refresh().pipe(
            tap(() => {
                self.auth = self.get(":auth");
                self.upstairs = self.proxy(self.get("portofino-upstairs", Upstairs, false)
                    .pipe(catchError(() => of(null))));
            }));
    }

    protected isProxyProperty(name) {
        return super.isProxyProperty(name) || name === "auth" || name === "upstairs";
    }

    logout(): Observable<Response> {
        const self = this;
        return (<any>this.auth).logout().pipe(tap(() => { self.token = null; }));
    }
}

export class Upstairs extends ResourceAction {}
