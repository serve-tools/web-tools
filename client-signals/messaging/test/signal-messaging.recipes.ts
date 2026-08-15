/// <reference lib="esnext.disposable" />

import type { Client } from "@serve-tools/client-messaging";
import { observe } from "../src/signal-messaging.js";

interface Protocol {
	requests: Record<never, never>;
	subscriptions: {
		progress(input: { job: string }): number;
	};
}

declare const client: Client<Protocol>;

const progress = observe(client, "progress", { input: { job: "build" } });
const state = progress.get();

if (state.status === "ready") console.log(`${state.value}%`);

progress.dispose();
