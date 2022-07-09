import {from, mergeMap, Observable, of} from "rxjs";
import {HttpClient, RequestInterceptor, ResponseInterceptor} from "./httpClient";

interface Operation {
    signature: string;
    name: string;
}

export class ResourceAction {
    public operations: string[] = [];

    constructor(
        protected url: string, protected parent: ResourceAction,
        protected errorHandler: (data: any) => void = console.error,
        public http: HttpClient = parent.http) {
    }

    refresh() {
        this.operations.forEach(op => { delete this[op]; });
        this.operations = [];
        const resource = this;
        this.http.get(this.url + "/:operations").pipe(mergeMap(v => from(v.json()))).subscribe({
            next(ops: Operation[]) {
                ops.forEach(op => resource.installOperation(op));
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

    installOperation(op: Operation) {
        if (!op.signature) {
            return;
        }
        const definition = op.signature.split(" ");
        const method = definition[0].toLowerCase();
        let path: string;
        if (definition.length > 1) {
            path = definition[1];
        } else {
            path = "";
        }
        const operationFunction = (config: RequestInit = {}) => {
            return this.http[method](this.url + "/" + path, config);
        }
        let name;
        if (this[op.name]) {
            name = "op_" + op.name;
        } else {
            name = op.name;
        }
        this[name] = operationFunction;
        this.operations.push(name);
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
        this.auth = this.get(":auth");
        this.upstairs = this.get("portofino-upstairs", Upstairs);
        return this;
    }
}

export class Upstairs extends ResourceAction {}