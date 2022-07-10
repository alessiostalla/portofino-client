import {BehaviorSubject, filter, from, map, mergeMap, Observable, of, takeWhile, tap} from "rxjs";
import {HttpClient, RequestInterceptor, ResponseInterceptor} from "./httpClient";

interface Operation {
    signature: string;
    name: string;
    available: boolean;
    invoke: (config: RequestInit) => Observable<Response>;
}

export class ResourceAction {
    public operations: { [name: string]: Operation } = {};
    public ready$ = new BehaviorSubject<boolean>(false);
    public whenReady$ = this.ready$.pipe(filter(ready => ready), map(() => this));

    constructor(
        protected url: string, protected parent: ResourceAction,
        protected errorHandler: (data: any) => void = console.error,
        public http: HttpClient = parent.http) {
    }

    refresh() {
        this.ready$.next(false);
        for (const op in this.operations) {
            delete this[op];
        }
        this.operations = {};
        const resource = this;
        this.http.get(this.url + "/:operations").pipe(mergeMap(v => from(v.json()))).subscribe({
            next(ops: Operation[]) {
                ops.forEach(op => resource.installOperation(op));
                resource.ready$.next(true);
            },
            error: this.errorHandler
        });
        return this;
    }

    get(segment: string, type: new (...args) => ResourceAction = ResourceAction): ResourceAction {
        if (segment.startsWith("/")) {
            return this.root.get(segment);
        } else {
            return new type(this.url + "/" + segment, this).refresh();
        }
    }

    get root() {
        return this.parent.root;
    }

    whenReady(fn: (it: this) => unknown) {
        const self = this;
        this.ready$.pipe(takeWhile(x => !x, true)).subscribe({
            next(ready) {
                if (ready) {
                    fn(self);
                }
            }
        });
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

export const NO_AUTH_HEADER = "X-Portofino-No-Authentication";

export interface Authenticator {
    authenticate(request: Request, portofino: Portofino): Observable<Response>;
}

export class UsernamePasswordAuthenticator implements Authenticator {
    constructor(protected username: string, protected password: string) {}

    authenticate(request: Request, portofino: Portofino): Observable<Response> {
        return (<any>portofino.auth).login({ json: { username: this.username, password: this.password } }).pipe(
            mergeMap((response: Response) => from(response.json())),
            mergeMap((userInfo: any) => {
                portofino.token = userInfo.jwt;
                return portofino.http.request(request);
            }));
    }
}

export class Portofino extends ResourceAction {
    public token: string;
    public auth: ResourceAction;
    public upstairs: Upstairs;

    constructor(url: string, errorHandler: (data: any) => void, protected authenticator?: Authenticator) {
        super(url, null, errorHandler, new HttpClient());
        const self = this;
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
                if (response.status === 401 && self.authenticator) {
                    return self.authenticator.authenticate(request, self);
                } else {
                    return of(response);
                }
            }
        };
        this.http.requestInterceptors = [credentialsInterceptor];
        this.http.responseInterceptors = [authInterceptor];
    }

    static connect(url, authenticator: Authenticator, errorHandler: (data: any) => void = console.error) {
        return new Portofino(url, errorHandler, authenticator).refresh();
    }

    get(segment: string, type: new (...args) => ResourceAction = ResourceAction) {
        if (!segment.startsWith("/")) {
            segment = "/" + segment;
        }
        return new type(this.url + segment, this).refresh();
    }

    get root() {
        return this;
    }

    refresh(): this {
        super.refresh();
        this.ready$.next(false);
        this.auth = this.get(":auth");
        const self = this;
        this.auth.whenReady(() => {
            self.ready$.next(true);
            self.upstairs = self.get("portofino-upstairs", Upstairs);
        });
        return this;
    }

    logout(): Observable<Response> {
        const self = this;
        return (<any>this.auth).logout().pipe(tap(() => { self.token = null; }));
    }
}

export class Upstairs extends ResourceAction {}