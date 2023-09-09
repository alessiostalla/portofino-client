import {enableFetchMocks, FetchMock} from 'jest-fetch-mock';
import {Portofino} from "../src/portofino";
import {FixedUsernamePasswordProvider, UsernamePasswordAuthenticator} from "../src/auth";
import {expect} from "@jest/globals";
enableFetchMocks();
const fetchMock = fetch as FetchMock;

test("Connect, no operations, no upstairs", (done) => {
    fetchMock.mockResponseOnce(JSON.stringify([]));
    const portofino = Portofino.connect(
        "http://localhost:8080", new UsernamePasswordAuthenticator(
            new FixedUsernamePasswordProvider("u", "p")));
    portofino.subscribe({
        next(p) {
            expect(p.operations).toBeFalsy();
        },
        error(e) { done(e); },
        complete() {
            portofino.upstairs.subscribe({
                next(u) { expect(u).toBe(null); },
                error(e) { done(e); }
            });
            done();
        }
    });
})
