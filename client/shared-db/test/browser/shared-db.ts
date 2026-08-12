/// <reference lib="webworker" />

import type { DB } from "@serve-tools/client-db";
import { listen } from "../../src/scope/shared-worker.js";

const scope = globalThis as unknown as SharedWorkerGlobalScope;

const server = listen<{
	users: DB.Store<{ id: string; name: string }, string>;
	logs: DB.Store<string, number>;
}>(`client-shared-db-${scope.name}`, {
	version: 1,
	upgrade(database) {
		database.createObjectStore("users", { keyPath: "id" });
		database.createObjectStore("logs", { autoIncrement: true });
	},
});

export type TestSchema = listen.SchemaType<typeof server>;
