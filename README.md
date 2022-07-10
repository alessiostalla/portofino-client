# portofino-commander

A JavaScript library to inspect and modify a [Portofino](https://github.com/ManyDesigns/Portofino) service.

Its only dependencies are RxJS and the fetch API.

## Usage

```javascript
// Connect, with credentials
const portofino = Portofino.connect(
    "http://localhost:8080/demo-tt/api", 
    new UsernamePasswordAuthenticator("admin", "admin"));
// Make requests
portofino.whenReady((p) => { // p is just a shorthand for portofino
    p.upstairs.getInfo().subscribe({ next(x) { console.log(x)}});
    // CRUD, list
    p.get("projects").whenReady(pr => pr.load().subscribe());
    // CRUD, single object
    p.get("projects/PRJ_1").whenReady(pr => pr.load().subscribe()); 
    // Alternate syntax, same effect as above
    p.get("projects").get("PRJ_1").whenReady(pr => pr.load().subscribe());
    // Upstairs methods
    p.upstairs.get("database/tables").whenReady(
        db => db.getTablesInSchema("db", "schema").subscribe());
});
// Or, if you need an Observable:
portofino.get("projects").whenReady$.subscribe(pr => pr.load().subscribe());
// Terminate the session
portofino.logout();
```
