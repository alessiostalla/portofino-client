[![npm version](https://badge.fury.io/js/portofino-commander.svg)](https://badge.fury.io/js/portofino-commander)

# portofino-commander

A JavaScript library to query, inspect and modify a [Portofino](https://github.com/ManyDesigns/Portofino) application.

It has few dependencies:
- The standard `fetch` API
- RxJS
- jwt-decode
- i18next

These all work both on the browser and in Node, therefore Portofino-commander runs in both environments.

## Installation

portofino-commander is available from the NPM Registry so we can use tools like NPM or Yarn to install it:

```
npm install --save portofino-commander
```

or

```
yarn add portofino-commander
```

For convenience, we also provide a minified bundle of Portofino-commander and its dependencies for use in the browser,
so you can include it like so:

```html
<script src="./static/bundle/portofino-commander-0.9.0-bundle.js" charset="UTF-8" defer></script>
```

You can find the bundle in the [Releases page](https://github.com/alessiostalla/portofino-commander/releases).

Such a deployment option is not recommended except for quick testing or very simple pages/applications.
In general, we recommend using proper build tools.  

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
const observer = {
    next(response) { response.json().then(json => console.log(json)); },
    error(e) { alert("Uh-oh!"); console.log(e); }
};
// Print info about the application
portofino.upstairs.getInfo().subscribe(observer);
// CRUD
const projectsCrud = portofino.get("projects");
// Note: on Portofino 5, we have replace `.load()` with `.op_get()` (see below)
// List
projectsCrud.load().subscribe(observer);
// CRUD, single object
projectsCrud.get("PRJ_1").load().subscribe(observer);
// Alternate syntax, same effect as above
portofino.get("projects/PRJ_1").load().subscribe(observer);
// Upstairs methods
portofino.upstairs.get("database/tables")
    .getTablesInSchema("db", "schema")
    .subscribe(observer);
// Terminate the session
portofino.logout().subscribe();
// Note how calls to `subscribe` are needed 
// to actually perform the HTTP requests to the backend.
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

While portofino-commander's general approach works perfectly well with Portofino 5, some REST APIs in P5 weren't 
designed with such a client in mind, and require some extra handling to invoke them.
For example, some methods require that we explicitly set an Accept header to restrict the response to JSON.
In other cases, operation names conflict with portofino-commander's own functions (e.g. "get"). This is the case of
the CRUD's load operation. In Portofino 5, instead of using `crud.load()`, we'll have to write `crud.op_get()` which
is a bit uglier to read.

## Authentication

Portofino-commander handles JWT-based authentication for you, including refreshing the token when it's about to expire.

We can easily write a `UsernamePasswordProvider` that asks the user for their credentials using the UI components
of our choice. Portofino-commander is completely UI agnostic (but its use of RxJS may integrate well with UI frameworks
that use RxJS, such as Angular).

## I18n

Portofino-commander uses I18next to translate error messages. It only comes with English translations and doesn't do 
any language detection on its own. It's easy to provide strings in other languages and plug in a language detector.
We can just follow I18next's documentation, and ensure that Portofino doesn't set up its default I18n configuration:

```javascript
i18next.init(...);
Portofino.connect(url, authenticator, { setupDefaultI18n: false });
```

## Licensing

Portofino-commander is licensed under the GNU AGPL. In layman terms, if you build any kind of tool or service on top of
it, you need to release its source code.
If you'd like to use portofino-commander as a component in a tool or service and require a more business-friendly license,
please open an issue or contact me directly. I'm open to licensing this to specific organizations so that they can use it,
but I prefer to have a say in that.

## Donations

You can help me develop and maintain this and other projects by donating to [my Patreon](https://www.patreon.com/alessiostalla).
