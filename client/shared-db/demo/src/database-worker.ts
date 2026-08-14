/// <reference lib="webworker" />

import type { DB } from "@serve-tools/client-db";
import { listen } from "@serve-tools/client-shared-db/scope/shared-worker";

const server = listen<{
	tasks: DB.Store<Task, string>;
}>("serve-tools-client-shared-db-demo", {
	version: 1,
	upgrade(database, { oldVersion }) {
		if (oldVersion < 1) database.createObjectStore("tasks", { keyPath: "id" });
	},
});

export interface Task {
	done: boolean;
	id: string;
	title: string;
	updatedAt: number;
}

export type DemoSchema = listen.SchemaType<typeof server>;
