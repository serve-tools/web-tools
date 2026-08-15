# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-shared-websocket.recipes.ts` fixture in the package source.

```ts
import type { SharedWebSocketClient } from "@serve-tools/client-shared-websocket/scope/window";
import { observe } from "@serve-tools/signal-shared-websocket";

declare const client: SharedWebSocketClient<{ subscriptions: { updates(): string } }>;

export const updates = observe(client, "updates");
```
