# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-event-source.recipes.ts` fixture in the package source.

```ts
import { connect, observe } from "@serve-tools/signal-event-source";

export const client = connect<{ presence: { online: number } }>("https://example.com/events");
export const presence = observe(client, "presence");
```
