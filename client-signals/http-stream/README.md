# @serve-tools/signal-http-stream

`@serve-tools/signal-http-stream` observes typed `@serve-tools/client-http-stream` subscriptions as explicit Signal state.

```ts
import { observe } from "@serve-tools/signal-http-stream";

const presence = observe(client, "presence", { input: { room: "lobby" } });
```

## Install

```shell
npm install @serve-tools/client-http-stream @serve-tools/signal-http-stream
```

`observe()` subscribes eagerly and returns `pending`, `ready`, `complete`, or `error` state.
Dispose the observation independently from the HTTP client.
Use `client.subscribe()` directly when every event occurrence matters.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-http-stream`](./skills/serve-tools-signal-http-stream/SKILL.md).

## License

[MIT-0](./LICENSE.md)
