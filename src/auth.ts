import {from, mergeMap, Observable, of} from "rxjs";

export const NO_AUTH_HEADER = "X-Portofino-No-Authentication";

export interface Authenticator {
    authenticate(request: Request, auth: any): Observable<{ jwt: string }>;
    refresh(auth: any): Observable<Response>;
}

export interface UsernamePasswordProvider {
    get(): Observable<{ username: string, password: string }>;
}

export class UsernamePasswordAuthenticator implements Authenticator {
    constructor(protected provider: UsernamePasswordProvider) {}

    authenticate(request: Request, auth: any): Observable<{ jwt: string }> {
        return this.provider.get().pipe(
            mergeMap(data => auth.login({ json: data })),
            mergeMap((response: Response) => from(response.json())));
    }

    refresh(auth: any): Observable<Response> {
        return auth.login({ json: {} });
    }

}

export class FixedUsernamePasswordProvider implements UsernamePasswordProvider {
    constructor(public username: string, public password: string) {}

    get(): Observable<{ username: string; password: string }> {
        return of(this);
    }
}
