# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-shared-event-source.recipes.ts` fixture in the package source.

```ts
import { listen } from "@serve-tools/signal-shared-event-source/scope/shared-worker";
import { connect, observe } from "@serve-tools/signal-shared-event-source";

interface Events {
	presence: { online: number };
}

declare const port: Parameters<typeof connect>[0];

export const server = listen<Events>("https://example.com/events");
export const client = connect<Events>(port);
export const presence = observe(client, "presence");
```
