import {RxJSHttpClient} from "rxjs-http-client";
import {mergeMap} from "rxjs";
import {HttpRequestConfig} from "rxjs-http-client/types/http-request-config.class";

interface Operation {
    signature: string;
    name: string;
}

export class ResourceAction {
    protected http: RxJSHttpClient;
    public operations: string[] = [];

    constructor(
        protected url: string, protected parent: ResourceAction,
        public errorHandler: (data: any) => void = console.error) {
        this.http = new RxJSHttpClient();
        this.refresh();
    }

    refresh() {
        this.operations.forEach(op => { delete this[op]; });
        this.operations = [];
        const resource = this;
        this.http.get(this.url + "/:operations").pipe(mergeMap(v => v.json())).subscribe({
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
        const operationFunction = (config?: Partial<HttpRequestConfig>) => {
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
    constructor(public url: string) {
        super(url, null);
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