# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-shared-db.recipes.ts` fixture in the package source.

```ts
import { Signal } from "@serve-tools/signal";
import { SignalDB } from "@serve-tools/signal-shared-db";

interface Schema {
	users: SignalDB.Store<{ id: string; name: string }, string>;
}

declare const port: MessagePort;

const database = SignalDB.connect<Schema>(port);
const selectedID = new Signal.State("ada");
const selectedUser = database.watch("users", selectedID);

await database.put("users", { id: "ada", name: "Ada" });

const state = selectedUser.get();

if (state.status === "ready") console.log(state.value?.name);

selectedUser.dispose();
database.close();
```
