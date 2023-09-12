import {enableFetchMocks, FetchMock} from 'jest-fetch-mock';
import {OperationDefinition, Portofino} from "../src/portofino";
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
            p.operations.subscribe({
                next(ops) {
                    expect(ops).toEqual({});
                },
                error(e) { done(e); },
            });
        },
        error(e) { done(e); },
        complete() {
            portofino.upstairs.subscribe({
                next(u) {
                    expect(u).toBe(null);
                },
                error(e) { done(e); },
                complete() { done(); }
            });
        }
    });
});

test("Connect w/operations, no upstairs", (done) => {
    const operations: OperationDefinition[] = [{
        signature: "GET coffee",
        available: true,
        name: "getCoffee"
    }];
    fetchMock.mockResponseOnce(JSON.stringify(operations));
    const portofino = Portofino.connect(
        "http://localhost:8080", new UsernamePasswordAuthenticator(
            new FixedUsernamePasswordProvider("u", "p")));
    portofino.subscribe({
        next(p) {
            p.operations.subscribe({
                next(ops) {
                    expect(ops["getCoffee"]).toBeTruthy();
                    expect(ops["getCoffee"].available).toEqual(operations[0].available);
                    expect(ops["getCoffee"].name).toEqual(operations[0].name);
                    expect(ops["getCoffee"].signature).toEqual(operations[0].signature);
                },
                error(e) { done(e); },
            });
        },
        error(e) { done(e); },
        complete() {
            portofino.upstairs.subscribe({
                next(u) {
                    expect(u).toBe(null);
                },
                error(e) { done(e); },
                complete() { done(); }
            });
        }
    });
});
