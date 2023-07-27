import {concatMap, from, mergeMap, Observable, of, throwError} from "rxjs";

const APPLICATION_JSON_TYPE = 'application/json';

export interface RequestInterceptor {
    intercept(request: Request): Request;
}

export interface ResponseInterceptor {
    intercept(request: Request, response: Response): Observable<Response>;
}

const CONTENT_TYPE_HEADER = 'Content-Type';

export interface ExtendedRequestInit extends RequestInit {
    json?: any;
}

export class HttpClient {
    constructor(
        public requestInterceptors: RequestInterceptor[] = [],
        public responseInterceptors: ResponseInterceptor[] = []) {
    }

    delete(url, config: ExtendedRequestInit = {}) {
        return this.request(new Request(url, {...config, method: "DELETE", body: null}));
    }

    get(url, config: ExtendedRequestInit = {}) {
        return this.request(new Request(url, {...config, method: "GET", body: null}));
    }

    post(url, config: ExtendedRequestInit = {}) {
        return this.request(this.requestWithBody(url, "POST", config));
    }

    put(url, config: ExtendedRequestInit = {}) {
        return this.request(this.requestWithBody(url, "PUT", config));
    }

    protected requestWithBody(url, method: string, requestInfo: ExtendedRequestInit) {
        const init: RequestInit = {...requestInfo, method: method};
        if (requestInfo.json) {
            init.body = JSON.stringify(requestInfo.json);
            if (init.headers) {
                const headers = <any>init.headers;
                if (typeof (headers.set) === "function") {
                    if (!headers.has(CONTENT_TYPE_HEADER)) {
                        headers.set(CONTENT_TYPE_HEADER, APPLICATION_JSON_TYPE);
                    }
                } else if (!headers[CONTENT_TYPE_HEADER]) {

                    headers[CONTENT_TYPE_HEADER] = APPLICATION_JSON_TYPE;
                }
            } else {
                init.headers = {'Content-Type': APPLICATION_JSON_TYPE};
            }
        }
        return new Request(url, init);
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
