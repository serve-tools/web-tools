# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-event-source.recipes.ts` fixture in the package source.

```ts
import { connect } from "@serve-tools/client-event-source";

export const events = connect<{
	message: { text: string };
	presence: { online: number };
}>("https://example.com/events", { withCredentials: true });

export const presence = events.subscribe("presence", ({ data, lastEventId }) => {
	console.log(lastEventId, data.online);
});
```
