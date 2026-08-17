/// <reference lib="esnext.disposable" />

import type { Client, Observation, ObservationState } from "../src/signal-messaging.js";
import { observe } from "../src/signal-messaging.js";

type Protocol = {
	requests: {
		refresh(): string;
	};
	subscriptions: {
		status(): string;
		progress(input: { readonly job: string }): number;
		optional(input: string | undefined): number;
	};
};

declare const client: Client<Protocol>;

const status: Observation<string> = observe(client, "status");
const configuredStatus: Observation<string> = observe(client, "status", { signal: new AbortController().signal });
const progress: Observation<number> = observe(client, "progress", { input: { job: "build" } });
const optional: Observation<number> = observe(client, "optional", { input: undefined });
const state: ObservationState<number> = progress.get();

// @ts-expect-error requests cannot be observed as subscriptions
observe(client, "refresh");
// @ts-expect-error unknown subscription
observe(client, "missing");
// @ts-expect-error input-bearing subscriptions require an input options object
observe(client, "progress");
// @ts-expect-error wrong subscription input
observe(client, "progress", { input: { id: 1 } });
// @ts-expect-error void subscriptions do not accept input
observe(client, "status", { input: "now" });

status.dispose();
configuredStatus.dispose();
progress.dispose();
optional.dispose();
void state;
