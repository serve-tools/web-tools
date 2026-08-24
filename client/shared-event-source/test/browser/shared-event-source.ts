/// <reference lib="webworker" />

import { listen } from "../../src/lib/scope/shared-worker.js";

const url = new URL("/__shared-event-source", self.location.origin);

url.searchParams.set("name", self.name);

const server = listen<{
	presence: { sequence: number; sourceCount: number };
}>(url);

export type TestEvents = listen.EventMapType<typeof server>;
