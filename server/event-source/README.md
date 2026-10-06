# @serve-tools/server-event-source

`@serve-tools/server-event-source` creates a Fetch-compatible `text/event-stream` handler for typed JSON Server-Sent Events.

Broadcast typed events to connected browsers using the standard EventSource protocol.
Send initial state when a browser connects, then broadcast changes from your application:

```ts
import { createHandler } from "@serve-tools/server-event-source";

export const events = createHandler<{ presence: { online: number } }>({
	connect(connection) {
		connection.send("presence", { online: 3 });
	},
});

export default { fetch: events };
```

Pass `events` to your host's Fetch adapter; Bun can run the default export directly.
A browser connected to that endpoint receives the initial count:

```js
const source = new EventSource("/events");
source.addEventListener("presence", (event) => {
	console.log(JSON.parse(event.data).online); // 3
});
// Later, when this view closes:
// source.close();
```

Mount the handler at `/events` in your HTTP application, or use the URL where your host serves it.
Call `events.send("presence", { online: 4 }, { id: "presence-42" })` from your application when the count changes to broadcast it to every connected browser.
See the [typed EventSource client](../../client/event-source/) to receive these events with inferred data types.

## Install

```shell
npm install @serve-tools/server-event-source
```

#### Import from a CDN

```js
import * as serverEventSource from "https://esm.run/@serve-tools/server-event-source";
```

The package root uses web APIs and can run in a browser; hosting a network server requires a server runtime.

The callable handler accepts `GET` requests and returns a UTF-8 `text/event-stream` response.
`send()` JSON-stringifies event data and supports the spec `id` field; reconnecting EventSource requests expose that value as `connection.lastEventId` from the `Last-Event-ID` header.
The default `message` event omits the optional `event:` field.

Use `comment()` for keepalives, `retry()` to set the browser reconnection delay, and `connection.send()` for per-client replay or initialization.
Returning a `204 No Content` response from `authorize()` tells a conforming EventSource client to stop reconnecting.
Authorization, connection, and cleanup failures use the runtime's native `reportError()` or `console.error()` when that web API is unavailable.
`maximumBufferedAmount` defaults to 16 MiB per connection; a client whose event queue would exceed the limit is failed and removed without affecting other clients.
Pass `headers` as any `HeadersInit` value to add response headers such as CORS policy.
`Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, and `X-Accel-Buffering: no` always override conflicting `headers` values.
The application remains responsible for replay storage, authorization, rate limits, proxy timeouts, and choosing stable event IDs.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-server-event-source`](./skills/serve-tools-server-event-source/SKILL.md).

## License

[MIT-0](./LICENSE.md)
