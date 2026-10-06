# @serve-tools/client-event-source

Receive named, typed JSON events from a server-sent event feed.
`@serve-tools/client-event-source` preserves native EventSource reconnection and event IDs.

```ts
import { connect } from "@serve-tools/client-event-source";

const events = connect<{
	message: { text: string };
	presence: { online: number };
}>("https://example.com/events", { withCredentials: true });

const presence = events.subscribe("presence", ({ data, lastEventId }) => {
	console.log(lastEventId, data.online);
});

addEventListener("pagehide", (event) => {
	if (event.persisted) return;
	presence.unsubscribe();
	events.close();
});
```

Subscribe to a live event feed without parsing JSON in every listener.
The example expects a server-sent `presence` event with JSON data such as `{"online":3}`; it logs the event ID and `3`.
The page keeps the connection active and releases its subscription and EventSource on a terminal `pagehide`.
Browser-managed reconnection follows native EventSource behavior, while declared payload types do not validate untrusted JSON.
Next, subscribe to additional named events on the same connection.
Use [Shared EventSource](../shared-event-source/) when several tabs should share one physical connection.

## Install

```shell
npm install @serve-tools/client-event-source
```

#### Import from a CDN

```js
import * as clientEventSource from "https://esm.run/@serve-tools/client-event-source";
```

Each event's `data` field is parsed with `JSON.parse`, so event values are restricted to JSON-compatible types.
The callback also receives the native event type, origin, and `lastEventId` used by EventSource reconnection.

The underlying native instance is available as `client.source` for `open`, `error`, `readyState`, `url`, and `withCredentials`.
Malformed JSON is reported through the client platform's global `reportError()` and does not replace the browser's native reconnection behavior.
Closing the client or aborting its lifetime signal closes the native EventSource.

Use `@serve-tools/server-event-source` to produce the matching `text/event-stream` response.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-event-source`](./skills/serve-tools-client-event-source/SKILL.md).

## License

[MIT-0](./LICENSE.md)
