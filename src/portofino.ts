import {RxJSHttpClient} from "rxjs-http-client";

export class ResourceAction {
    protected http: RxJSHttpClient;

    constructor(
        protected url: string, protected parent: ResourceAction,
        public errorHandler: (data: any) => void = console.error) {
        this.http = new RxJSHttpClient();
        this.http.get(this.url + "/:operations").subscribe({
            next(value) {
                console.log(value);
            },
            error: this.errorHandler
        })
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
}

export class Portofino extends ResourceAction {
    constructor(public url: string) {
        super(url, null);
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