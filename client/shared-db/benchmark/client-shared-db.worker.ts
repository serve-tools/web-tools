/// <reference lib="webworker" />

import type { DB } from "@serve-tools/client-db";
import { listen } from "../src/scope/shared-worker.js";

const scope = globalThis as unknown as SharedWorkerGlobalScope;

const server = listen<{
	records: DB.Store<{ id: number; value: string }, number>;
}>(`client-shared-db-benchmark-${scope.name}`, {
	version: 1,
	upgrade(database) {
		database.createObjectStore("records", { keyPath: "id" });
	},
});

export type BenchmarkSchema = listen.SchemaType<typeof server>;
