# @serve-tools/signal-http-stream

`@serve-tools/signal-http-stream` provides the typed HTTP streaming client together with explicit Signal state.

```ts
import { connect, observe } from "@serve-tools/signal-http-stream";

const client = connect("/realtime");
const presence = observe(client, "presence", { input: { room: "lobby" } });
```

## Install

```shell
npm install @serve-tools/signal-http-stream
```

The package re-exports the complete `@serve-tools/client-http-stream` API unchanged.
`observe()` subscribes eagerly and returns `pending`, `ready`, `complete`, or `error` state.
Dispose the observation independently from the HTTP client.
Use `client.subscribe()` directly when every event occurrence matters.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-http-stream`](./skills/serve-tools-signal-http-stream/SKILL.md).

## License

[MIT-0](./LICENSE.md)
