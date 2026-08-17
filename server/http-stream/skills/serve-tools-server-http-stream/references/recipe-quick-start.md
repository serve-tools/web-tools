# Recipe: quick start

This public-import example is generated from the compile-checked `test/server-http-stream.recipes.ts` fixture in the package source.

```ts
import type { Handlers } from "@serve-tools/server-http-stream";
import { createHandler } from "@serve-tools/server-http-stream";

interface Protocol {
	requests: { identity(): string };
	subscriptions: { notices(): string };
}

interface Session {
	readonly userID: string;
}

const handlers = {
	requests: { identity: (_input, { connection }) => connection.userID },
	subscriptions: { notices: (_input, { emit }) => void emit("ready") },
} satisfies Handlers<Protocol, Session>;

/** A compile-tested authorized Fetch handler recipe. */
export const serverHTTPStreamRecipe = () =>
	createHandler(handlers, {
		authorize: (request) => ({ userID: request.headers.get("authorization") ?? "anonymous" }),
	});
```
