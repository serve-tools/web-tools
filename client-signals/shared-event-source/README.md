# @serve-tools/signal-shared-event-source

`@serve-tools/signal-shared-event-source` provides the shared EventSource client together with latest-event Signal state.

```ts
import { connect, observe } from "@serve-tools/signal-shared-event-source";

const client = connect<Events>(worker.port);
const presence = observe(client, "presence");

const state = presence.get();
if (state.status === "ready") console.log(state.event.lastEventId, state.event.data.online);
```

## Install

```shell
npm install @serve-tools/signal-shared-event-source
```

Use `@serve-tools/signal-shared-event-source/scope/shared-worker` for `listen()` and the package root or `/scope/window` for `connect()` and `observe()`.
The complete event record remains page-owned Signal state, including `lastEventId`.
Use the underlying shared client subscription when every event occurrence matters.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-shared-event-source`](./skills/serve-tools-signal-shared-event-source/SKILL.md).

## License

[MIT-0](./LICENSE.md)
