# portofino-commander

A JavaScript library to inspect and modify a [Portofino](https://github.com/ManyDesigns/Portofino) service.

Its only dependencies are RxJS and the fetch API. Therefore, it can work both on the browser and in Node.

## Usage

We start by connecting to a running Portofino service:

```javascript
const portofino = Portofino.connect(
    "http://localhost:8080/demo-tt/api", 
    new UsernamePasswordAuthenticator(
        new FixedUsernamePasswordProvider("admin", "admin")));
```
Then, we can make requests to the server. Every resource and request is an RxJS Observable. 
These are proxied so that we don't have to explicitly pipe or subscribe to chain them. Some examples:

```javascript
const observer = { next(x) { console.log(x) }};
// Print info about the application
portofino.upstairs.getInfo().subscribe(observer);
// CRUD, list
portofino.get("projects").load().subscribe(observer);
// CRUD, single object
portofino.get("projects/PRJ_1").load().subscribe(observer);
// Alternate syntax, same effect as above
portofino.get("projects").get("PRJ_1").load().subscribe(observer);
// Upstairs methods
portofino.upstairs.get("database/tables")
    .getTablesInSchema("db", "schema")
    .subscribe(observer);
// Terminate the session
portofino.logout().subscribe();
```

Operations such as _load()_ above for CRUD, or _getTablesInSchema(db, schema)_, are automatically discovered by querying the Portofino service.
That's why `resource.get(subresource)` returns an _Observable_.

### Introspection

To know the available operations on a resource and their signature, access its _operations_ property:

```javascript
portofino.get("projects").operations.subscribe(observer);
//Or, alternatively
portofino.get("projects").subscribe({ 
    next(p) { console.log(p.operations); }
});
```

Each operation can be invoked:

```javascript
portofino.get("projects").operations.pipe(
    mergeMap(ops => ops["load"].invoke())
).subscribe(observer);
```

Usually there's no reason to invoke them like this when we can simply use proxied methods.

### Explicit RxJS

If for whatever reason we want to use the RxJS APIs directly without proxies we can do so:

```javascript
portofino.pipe(
    mergeMap(p => p.get("projects")),
    mergeMap(pr => pr.get("PRJ_1")),
    mergeMap(prj1 => prj1.load())
).subscribe();
```

Notice how _portofino_ as well as everything _get_ returns is an _Observable&lt;ResourceAction&gt;_, while the result of
invoking operations on the server (such as _load_ in the previous example) is an _Observable&lt;Response&gt;_.

## Compatibility

portofino-commander is developed and tested against Portofino 6.

While portofino-commander's general approach works perfectly well with Portofino 5, some REST APIs in P5 weren't designed with 
such a client in mind, and require some extra handling to invoke them. For example, some methods require that we 
explicitly set an Accept header to restrict the response to JSON. In other cases, operation names conflict with 
portofino-commander's own functions (e.g. "get") and thus we cannot call them using the simplified syntax that we've 
shown in the Usage section.