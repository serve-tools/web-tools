/// <reference lib="esnext.disposable" />

import { connect, observe } from "../src/signal-messaging.js";

interface Protocol {
	requests: Record<never, never>;
	subscriptions: {
		progress(input: { job: string }): number;
	};
}

declare const port: MessagePort;

const client = connect<Protocol>(port);
const progress = observe(client, "progress", { input: { job: "build" } });
const state = progress.get();

if (state.status === "ready") {
	console.log(`${state.value}%`);
}

progress.dispose();
