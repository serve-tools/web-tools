/// <reference lib="dom" />

import { SharedWorker } from "@serve-tools/client-messaging/scope/window";
import type { DemoProtocol } from "./shared-worker.js";

const worker = new SharedWorker<DemoProtocol>(new URL("./shared-worker.ts", import.meta.url), {
	name: "client-messaging-demo",
	type: "module",
});

export const { client } = worker;

addEventListener(
	"pagehide",
	() => {
		client.close();
		worker.port.close();
	},
	{ once: true },
);
