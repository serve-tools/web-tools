/// <reference lib="esnext.disposable" />

import type { DB } from "@serve-tools/client-db";
import { connect } from "../src/lib/scope/window.js";

interface Schema {
	users: DB.Store<{ id: string; name: string }, string>;
}

declare const port: MessagePort;

const database = connect<Schema>(port);
const changes = database.subscribe("users", (change) => {
	if (change.kind === "added") {
		console.log(change.value.name);
	}
});

await database.put("users", { id: "ada", name: "Ada" });
const user = await database.get("users", "ada");

changes.unsubscribe();
database.close();
void user;
