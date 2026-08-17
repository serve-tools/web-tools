# @serve-tools/server-event-source

`@serve-tools/server-event-source` creates a Fetch-compatible `text/event-stream` handler for typed JSON Server-Sent Events.

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

## Install

```shell
npm install @serve-tools/server-event-source
```

The callable handler accepts `GET` requests and returns a UTF-8 `text/event-stream` response.
`send()` JSON-stringifies event data and supports the spec `id` field; reconnecting EventSource requests expose that value as `connection.lastEventId` from the `Last-Event-ID` header.
The default `message` event omits the optional `event:` field.

Use `comment()` for keepalives, `retry()` to set the browser reconnection delay, and `connection.send()` for per-client replay or initialization.
Returning a `204 No Content` response from `authorize()` tells a conforming EventSource client to stop reconnecting.
Authorization, connection, and cleanup failures use the runtime's native `reportError()` or `console.error()` when that web API is unavailable.
The application remains responsible for replay storage, authorization, CORS, rate limits, proxy timeouts, and choosing stable event IDs.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-server-event-source`](./skills/serve-tools-server-event-source/SKILL.md).

## License

[MIT-0](./LICENSE.md)
