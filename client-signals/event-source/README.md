# @serve-tools/signal-event-source

Render the latest named server-sent event without maintaining your own state or listener plumbing.
The observation retains both parsed JSON data and the event ID.

The endpoint must serve `text/event-stream` records with `event: presence` and JSON `data`, for example `{"online":3}`.

```ts
import { effect } from "@serve-tools/signal-effect";
import { connect, observe } from "@serve-tools/signal-event-source";

const client = connect<{ presence: { online: number } }>("/events");
const presence = observe(client, "presence");
const output = document.createElement("output");
document.body.append(output);
const stop = effect(() => {
	const state = presence.get();
	output.value = state.status === "ready" ? `${state.event.data.online} online` : "Waiting for presence…";
});

addEventListener("pagehide", (event) => {
	if (event.persisted) return;

	stop();
	presence.dispose();
	client.close();
});
```

Each matching event updates the output automatically.
The effect renders the watched state; Signal-aware UI libraries can consume the same observation directly.

## Install

```shell
npm install @serve-tools/signal-event-source @serve-tools/signal-effect
```

#### Import from a CDN

```js
import * as signalEventSource from "https://esm.run/@serve-tools/signal-event-source";
```

The package re-exports the complete `@serve-tools/client-event-source` API, including `connect()` and its types.
The observation starts in `pending` state and becomes `ready` with the latest parsed event.
The complete event record is retained so reactive consumers do not lose `lastEventId`.
Dispose the observation independently from the EventSource client, and use `client.subscribe()` when every event occurrence matters.

## Choose current state or every event

Use [`@serve-tools/client-event-source`](../../client/event-source/) when every event occurrence matters.
Use this package for a reactive snapshot of the latest event; Signal consumers may coalesce intermediate values.
Use [`@serve-tools/signal-shared-event-source`](../shared-event-source/) when several tabs should share one EventSource connection.

An EventSource observation has `pending` and `ready` states.
Native EventSource owns reconnection; this adapter does not invent completion or error states for that browser-managed stream.
Use `state.event.lastEventId` alongside `state.event.data` when displaying or recording the latest server event ID.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-event-source`](./skills/serve-tools-signal-event-source/SKILL.md).

## License

[MIT-0](./LICENSE.md)
