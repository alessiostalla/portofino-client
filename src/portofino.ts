import {concatMap, from, map, mergeMap, of, throwError, Observable} from "rxjs";

interface Operation {
    signature: string;
    name: string;
}

export class ResourceAction {
    public operations: string[] = [];

    constructor(
        protected url: string, protected parent: ResourceAction,
        protected http: HttpClient = parent.http,
        protected errorHandler: (data: any) => void = console.error) {
        this.refresh();
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
    }

    get(segment: string): ResourceAction {
        if (segment.startsWith("/")) {
            return this.root.get(segment);
        } else {
            return new ResourceAction(this.url + "/" + segment, this);
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

export class Portofino extends ResourceAction {
    constructor(url: string, errorHandler: (data: any) => void = console.error) {
        const authInterceptor: ResponseInterceptor = {
            intercept(request, response, http) {
                if (response.status === 401) {
                    return http.request(request); //TODO ask for credentials
                } else {
                    return of(response);
                }
            }
        };
        super(url, null, new HttpClient([],[authInterceptor]), errorHandler);
    }

    static connect(url) {
        return new Portofino(url);
    }

    get(segment: string) {
        if (!segment.startsWith("/")) {
            segment = "/" + segment;
        }
        return new ResourceAction(this.url + segment, this);
    }

    get root() {
        return this;
    }
}

export interface RequestInterceptor {
    intercept(request: Request, http: HttpClient): Request;
}

export interface ResponseInterceptor {
    intercept(request: Request, response: Response, http: HttpClient): Observable<Response>;
}

export class HttpClient {
    constructor(
        protected requestInterceptors: RequestInterceptor[] = [],
        protected responseInterceptors: ResponseInterceptor[] = []) {}

    get(url, config: RequestInit = {}) {
        return this.request(new Request(url, {...config, method: "GET", body: null }));
    }

    request(request: Request): Observable<Response> {
        for (const interceptor of this.requestInterceptors) {
            request = interceptor.intercept(request, this);
        }
        let observable = from(fetch(request));
        for (const interceptor of this.responseInterceptors) {
            observable = observable.pipe(mergeMap(response => interceptor.intercept(request, response, this)));
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