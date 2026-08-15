import { Signal } from "@serve-tools/signal";
import { SignalDB } from "../src/signal-shared-db.js";

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
