import {Portofino, UsernamePasswordAuthenticator} from "./portofino";
import {mergeMap} from "rxjs";

(<any>window).Portofino = Portofino;
(<any>window).UsernamePasswordAuthenticator = UsernamePasswordAuthenticator;
(<any>window).mergeMap = mergeMap;