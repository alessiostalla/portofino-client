import {FixedUsernamePasswordProvider, Portofino, UsernamePasswordAuthenticator} from "./portofino";
import {mergeMap} from "rxjs";

(<any>window).Portofino = Portofino;
(<any>window).UsernamePasswordAuthenticator = UsernamePasswordAuthenticator;
(<any>window).FixedUsernamePasswordProvider = FixedUsernamePasswordProvider;
(<any>window).mergeMap = mergeMap;