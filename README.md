[![npm version](https://badge.fury.io/js/portofino-commander.svg)](https://badge.fury.io/js/portofino-commander)

# Portofino-commander

A JavaScript library to query, inspect and modify a [Portofino](https://github.com/ManyDesigns/Portofino) service. We can use this to build an application
on top of a Portofino backend.

Portofino-commander has few dependencies:
- The standard `fetch` API, for HTTP requests;
- RxJS, for reactive APIs;
- jwt-decode, to handle authentication;
- i18next, for internationalization.

These all work on the browser as well as in Node, therefore Portofino-commander runs in both environments.

## Installation

Portofino-commander is available from the NPM Registry, so we can use tools like NPM or Yarn to install it:

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
<script src="./static/bundle/portofino-commander-0.9.2-bundle.js" charset="UTF-8" defer></script>
```

You can find the bundle in the [Releases page](https://github.com/alessiostalla/portofino-commander/releases).

Such a deployment option is not recommended except for quick testing or very simple pages/applications.
In general, we recommend using proper build tools.  

## Usage

Portofino-commander tries to provide intuitive APIs on top of a relatively complex implementation. Let's see how to use it.

### Connection to a Portofino Service

We start by connecting to a running Portofino service:

```javascript
const portofino = Portofino.connect(
    "http://localhost:8080", 
    new UsernamePasswordAuthenticator(
        new FixedUsernamePasswordProvider("admin", "admin")));
```

The above applies to Portofino 5 and 6 services (based on Spring Boot).

**Note** that, in a production or staging application, the service is going to be exposed with a public or internal
URL, most probably behind a reverse proxy. So, the actual URL will vary accordingly to the server's configuration.

#### Non-standard Service URL
Even on a development machine, a service could have a non-standard configuration, and its address could be different.

If unsure, check the log messages emitted while the service starts up and look for lines like the following:

```
PortofinoJerseyAutoConfiguration : API path: /abc/
```

and then:

```
TomcatWebServer  : Tomcat started on port(s): 12345 (http) with context path 'xyz'
```

These tell us that the root of the Portofino REST APIs is `http://localhost:12345/xyz/abc`. Normally, though, the API 
path is `/`, the context path is the empty string, and the port is 8080, so we obtain the URL in the example, 
`http://localhost:8080/`.

### Connection to a Portofino 5 Web Application

If connecting to a Portofino 5 application deployed as a .war file, instead, the URL will be different, and it will 
typically look like `http://localhost:8080/demo-tt/api`.

`demo-tt` is the context path (in layman terms, a portion of the URL identifying the application). It could be missing
if the application is deployed at the root (e.g., on Tomcat, if the .war file is named ROOT.war).

`/api` is the REST API root, because if we access `http://localhost:8080/demo-tt` we'll receive the HTML of the 
application's home page. This path can be customized in the application's `web.xml` file, but `/api` is the
default, and it rarely gets changed.

Again, this only applies to local usage in a development environment. A deployed .war application will have a different
URL, that depends on the configuration of the server. 

### Making Requests

Once we've got a connection, we can make requests to the server. We do this conceptually in two steps:
- First, we obtain a _resource_ (e.g. a CRUD `ResourceAction`) – this is a _class_ in the application;
- Then, we invoke an _operation_ on the resource (e.g. "save" on an CRUD) – this is a _method_ of the resource.

Portofino-commander implements both access to a resource and invocation of an operation with an RxJS Observable. 
Observables are proxied so that we don't have to use the RxJS APIs (such as `pipe` or `subscribe`) to chain them.
Some examples follow.

Let's first define an _observer_ that will just print the result of an operation to the console:

```javascript
const observer = {
    next(response) { response.json().then(json => console.log(json)); },
    error(e) { alert("Uh-oh!"); console.log(e); }
};
```

Then, we can invoke an operation like so:

```javascript
// Print info about the application
portofino.upstairs.getInfo().subscribe(observer);
```

`portofino.upstairs` is a special resource that is pre-filled by Portofino-commander if it's available on the service.

We can access other resources using the `get` method:

```javascript
const projectsCrud = portofino.get("projects");
```

Then, we can invoke operations on it:

```javascript
// List
projectsCrud.load().subscribe(observer);
// CRUD, single object
projectsCrud.load("PRJ_1").subscribe(observer);
```

We can also access sub-resources. In the following, the effect is the same as the above (loading an object from a CRUD
resource):

```javascript
const project1 = projectsCrud.get("PRJ_1");
project1.load().subscribe(observer);
```

`get` can also access a subpath:

```javascript
portofino.get("projects/PRJ_1").load().subscribe(observer);
```

A more involved example, invoking an upstairs operation:

```javascript
portofino.upstairs.get("database/tables")
    .getTablesInSchema("db", "schema")
    .subscribe(observer);
```

**Note:** when connecting to a Portofino 5 service or application, we have to replace `.load()` with `.op_get()` (see below).

When we're done, we should terminate the session:

```javascript
portofino.logout().subscribe();
```

Note how calls to `subscribe` are needed to actually perform the HTTP requests to the backend. This is because RxJS is
"lazy" and doesn't run any code until someone looks at the results (i.e. subscribes to the observable).

Portofino-commander automatically discovers operations such as _load()_ above for CRUD, or _getTablesInSchema(db, schema)_,
by querying the Portofino service. That's why `resource.get(subresource)` returns an _Observable_. The resource is only
"ready" after the service has responded with the list of available operations for that resource.

Note that the operations that are available also depend on the user's identity. Some users may not have the privileges
to invoke a certain operation, in that case, it won't be available in the client.

### Introspection

To know which operations are available on a resource and what parameters they accept, we access the _operations_ 
property of the resource:

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

Usually there's no reason to invoke them like this when we can simply use proxied methods as shown in the previous 
section. In fact, the above code is equivalent to:

```javascript
portofino.get("projects").load().subscribe(observer);
```

### Passing Parameters

Some operations may accept parameters. These can be:

- **Path parameters**. We pass them as arguments of the operation, e.g. `someResource.someOperation("pathParam1", "pathParam2")`
- **Other parameters** such as query string parameters, headers, or the HTTP request body. We pass these in an object 
  as the **last** argument of the operation, e.g. `someCrud.save("id", { json: { ... } })`. This object conforms to the
  `options` parameter of the [standard `fetch` API](https://developer.mozilla.org/en-US/docs/Web/API/fetch) with a couple
  of extra properties for convenience, such as `json` shown earlier that automatically converts a JSON body to a string
  and sets the right `Content-Type` header.

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

Portofino-commander is developed and tested against Portofino 6.

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

## Forms

Work in progress.

## Licensing

Portofino-commander is licensed under the GNU AGPL. In layman terms, if you build any kind of tool or service on top of
it, you need to release its source code.
If you'd like to use portofino-commander as a component in a tool or service and require a more business-friendly license,
please open an issue or contact me directly. I'm open to licensing this to specific organizations so that they can use it,
even free of charge, but I prefer to have a say in that.

## Donations

You can help me develop and maintain this and other projects by donating to [my Patreon](https://www.patreon.com/alessiostalla).
