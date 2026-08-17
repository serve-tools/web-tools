# Recipe: quick start

This public-import example is generated from the compile-checked `test/server-event-source.recipes.ts` fixture in the package source.

```ts
import { createHandler } from "@serve-tools/server-event-source";

export const events = createHandler<{
	message: { text: string };
	presence: { online: number };
}>({
	connect(connection) {
		console.log("resume after", connection.lastEventId);
	},
});

events.send("presence", { online: 3 }, { id: "presence-42" });
```
