# Recipe: quick start

This public-import example is generated from the compile-checked `test/server-webtransport.recipes.ts` fixture in the package source.

```ts
import type { Handlers, SessionTransport } from "@serve-tools/server-webtransport";
import { createSession } from "@serve-tools/server-webtransport";

interface Protocol {
	requests: { identity(): string };
	datagrams: {
		cursor: { client: { x: number; y: number }; server: { x: number; y: number } };
	};
}

interface Context {
	readonly userID: string;
}

const handlers = {
	requests: { identity: (_input, { connection }) => connection.userID },
	datagrams: { cursor: (value, { datagrams }) => datagrams.write("cursor", value) },
} satisfies Handlers<Protocol, Context>;

/** A compile-tested sans-I/O WebTransport session recipe. */
export const serverWebTransportRecipe = (transport: SessionTransport, context: Context) =>
	createSession(handlers, transport, context);
```
