# @serve-tools/signal-event-source

`@serve-tools/signal-event-source` provides the typed EventSource client together with latest-event Signal state.

```ts
import { connect, observe } from "@serve-tools/signal-event-source";

const client = connect<{ presence: { online: number } }>("/events");
const presence = observe(client, "presence");

const state = presence.get();
if (state.status === "ready") console.log(state.event.lastEventId, state.event.data.online);
```

## Install

```shell
npm install @serve-tools/signal-event-source
```

The package re-exports the complete `@serve-tools/client-event-source` API, including `connect()` and its types.
The observation starts in `pending` state and becomes `ready` with the latest parsed event.
The complete event record is retained so reactive consumers do not lose `lastEventId`.
Dispose the observation independently from the EventSource client, and use `client.subscribe()` when every event occurrence matters.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-event-source`](./skills/serve-tools-signal-event-source/SKILL.md).

## License

[MIT-0](./LICENSE.md)
