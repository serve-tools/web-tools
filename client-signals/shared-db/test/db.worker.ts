/// <reference lib="webworker" />

import type { SignalDB } from "../src/db.js";
import { listen } from "../src/shared-worker.js";

export interface User {
	id: string;
	name: string;
}

const server = listen<{
	users: SignalDB.Store<User, string>;
	logs: SignalDB.Store<string, number>;
}>(`signal-tools-db-${(globalThis as unknown as SharedWorkerGlobalScope).name}`, {
	version: 1,
	upgrade(database) {
		database.createObjectStore("users", { keyPath: "id" });
		database.createObjectStore("logs", { autoIncrement: true });
	},
});

export type BrowserTestSchema = listen.SchemaType<typeof server>;
