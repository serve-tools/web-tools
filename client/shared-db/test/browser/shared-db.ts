/// <reference lib="webworker" />

import type { DB } from "@serve-tools/client-db";
import { activate } from "../../src/scope/shared-worker.js";

export interface TestSchema {
	users: DB.Store<{ id: string; name: string }, string>;
	logs: DB.Store<string, number>;
}

const scope = globalThis as unknown as SharedWorkerGlobalScope;

activate<TestSchema>(`client-shared-db-${scope.name}`, {
	version: 1,
	upgrade(database) {
		database.createObjectStore("users", { keyPath: "id" });
		database.createObjectStore("logs", { autoIncrement: true });
	},
});
