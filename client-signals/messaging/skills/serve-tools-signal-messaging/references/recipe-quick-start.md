# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-messaging.recipes.ts` fixture in the package source.

```ts
/// <reference lib="esnext.disposable" />

import { connect, observe } from "@serve-tools/signal-messaging";

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
```
