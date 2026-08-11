/// <reference lib="esnext.disposable" />

import type { DB } from "@serve-tools/client-db";
import { activate, type SharedDBServer } from "../src/scope/shared-worker.js";
import { connect, type SharedDBChange, type SharedDBClient } from "../src/scope/window.js";

interface Schema {
	users: DB.Store<{ id: string; name: string }, string>;
	logs: DB.Store<string, number>;
}

declare const port: MessagePort;

const client: SharedDBClient<Schema> = connect<Schema>(port);
const server: SharedDBServer<Schema> = activate<Schema>("app", {
	version: 1,
	upgrade(database) {
		database.createObjectStore("users", { keyPath: "id" });
		database.createObjectStore("logs", { autoIncrement: true });
	},
});
const user: Promise<{ id: string; name: string } | undefined> = client.get("users", "1");
const rangedUsers: Promise<{ id: string; name: string }[]> = client.getAll("users", {
	query: IDBKeyRange.bound("a", "z"),
});
const logKey: Promise<number> = client.add("logs", "started");
const users = client.subscribe("users", (change) => {
	const typed: SharedDBChange<Schema, "users"> = change;

	if (change.kind === "added") change.value.name;
	if (change.kind === "removed") change.key.toUpperCase();
	if (change.kind === "invalidated") change.key?.toUpperCase();

	void typed;
});
const both = client.subscribe(["users", "logs"] as const, (change) => {
	if (change.store === "users" && change.kind === "added") change.value.name;
	if (change.store === "logs" && change.kind === "added") change.value.toUpperCase();
});

client.subscribe("users", () => {}, {
	onReady(revision) {
		revision.toFixed();
	},
	onError(error) {
		error.message;
	},
});

// @ts-expect-error unknown object store
client.get("missing", "1");
// @ts-expect-error key does not match the object store schema
client.get("users", 1);
// @ts-expect-error value does not match the object store schema
client.put("logs", { message: "started" });
// @ts-expect-error subscriptions only accept declared stores
client.subscribe("missing", () => {});
// @ts-expect-error the remote point-operation client does not expose transactions
client.transaction("users");
// @ts-expect-error the remote point-operation client does not expose scans
client.scan("users");

void server;
void user;
void rangedUsers;
void logKey;
void users;
void both;
