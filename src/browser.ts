import {Portofino} from "./portofino";
import {mergeMap} from "rxjs";
import {FixedUsernamePasswordProvider, UsernamePasswordAuthenticator} from "./auth";

(<any>window).Portofino = Portofino;
(<any>window).UsernamePasswordAuthenticator = UsernamePasswordAuthenticator;
(<any>window).FixedUsernamePasswordProvider = FixedUsernamePasswordProvider;
(<any>window).mergeMap = mergeMap;
