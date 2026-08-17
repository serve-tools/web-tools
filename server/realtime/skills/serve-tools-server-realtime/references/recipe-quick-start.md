# Recipe: quick start

This public-import example is generated from the compile-checked `test/server-realtime.recipes.ts` fixture in the package source.

```ts
import type { Handlers } from "@serve-tools/server-realtime";
import { createConnection } from "@serve-tools/server-realtime";

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

/** A compile-tested sans-I/O server adapter recipe. */
export function serverRealtimeRecipe(send: (payload: ArrayBuffer) => void, session: Session) {
	return createConnection(handlers, { send, close: console.log }, session);
}
```
