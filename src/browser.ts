import {Portofino} from "./portofino";
import {mergeMap} from "rxjs";
import {FixedUsernamePasswordProvider, UsernamePasswordAuthenticator} from "./auth";
import {FormAdapter} from "./forms/forms";

(<any>window).Portofino = Portofino;
(<any>window).UsernamePasswordAuthenticator = UsernamePasswordAuthenticator;
(<any>window).FixedUsernamePasswordProvider = FixedUsernamePasswordProvider;
(<any>window).mergeMap = mergeMap;
(<any>window).FormAdapter = FormAdapter;
