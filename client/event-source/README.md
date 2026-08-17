# @serve-tools/client-event-source

`@serve-tools/client-event-source` adds typed JSON events to the native `EventSource` API while preserving browser-managed reconnection and event IDs.

```ts
import { connect } from "@serve-tools/client-event-source";

using events = connect<{
	message: { text: string };
	presence: { online: number };
}>("https://example.com/events", { withCredentials: true });

using presence = events.subscribe("presence", ({ data, lastEventId }) => {
	console.log(lastEventId, data.online);
});
```

## Install

```shell
npm install @serve-tools/client-event-source
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
