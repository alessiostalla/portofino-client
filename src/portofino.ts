import {concatMap, from, map, mergeMap, of, throwError, Observable} from "rxjs";
import * as http from "http";

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

    get(segment: string): ResourceAction {
        if (segment.startsWith("/")) {
            return this.root.get(segment);
        } else {
            return new ResourceAction(this.url + "/" + segment, this).refresh();
        }
    }

    get root() {
        return this.parent.root;
    }

    installOperation(op: Operation) {
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
        const loginReq: RequestInit = {
            body: JSON.stringify({ username: this.username, password: this.password }),
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };
        return (<any>portofino.auth).login(loginReq).pipe(
            mergeMap((response: Response) => from(response.json())),
            mergeMap((userInfo: any) => {
                portofino.token = userInfo.jwt;
                return portofino.http.request(request);
            }));
    }
}

export class Portofino extends ResourceAction {
    public auth: ResourceAction;
    public token: string;

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

    get(segment: string) {
        if (!segment.startsWith("/")) {
            segment = "/" + segment;
        }
        return new ResourceAction(this.url + segment, this).refresh();
    }

    get root() {
        return this;
    }

    refresh(): this {
        super.refresh();
        this.auth = this.get(":auth");
        return this;
    }
}

export interface RequestInterceptor {
    intercept(request: Request): Request;
}

export interface ResponseInterceptor {
    intercept(request: Request, response: Response): Observable<Response>;
}

export class HttpClient {
    constructor(
        public requestInterceptors: RequestInterceptor[] = [],
        public responseInterceptors: ResponseInterceptor[] = []) {}

    get(url, config: RequestInit = {}) {
        return this.request(new Request(url, {...config, method: "GET", body: null }));
    }

    post(url, config: RequestInit = {}) {
        return this.request(new Request(url, {...config, method: "POST", body: config.body }));
    }

    request(request: Request): Observable<Response> {
        for (const interceptor of this.requestInterceptors) {
            request = interceptor.intercept(request);
        }
        let observable = from(fetch(request));
        for (const interceptor of this.responseInterceptors) {
            observable = observable.pipe(mergeMap(response => interceptor.intercept(request, response)));
        }
        return observable.pipe(checkHttpStatus());
    }
}

export function checkHttpStatus() {
    return function (source) {
        return source.pipe(concatMap((res: Response) => {
            return res.ok
                ? of(res)
                : throwError(() => res);
        }));
    };
}