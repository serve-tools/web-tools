# @serve-tools/signal-webtransport

`@serve-tools/signal-webtransport` provides the typed WebTransport client together with reliable subscription Signal state.

```ts
import { connect, observe } from "@serve-tools/signal-webtransport";

const client = await connect("https://example.com/realtime");
const presence = observe(client, "presence", { input: { room: "lobby" } });
```

## Install

```shell
npm install @serve-tools/signal-webtransport
```

The package re-exports the complete `@serve-tools/client-webtransport` API unchanged.
The adapter applies to reliable subscriptions, not best-effort datagrams.
Use the client's datagram API when every arriving datagram occurrence matters.
Dispose observations independently from the WebTransport client.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-webtransport`](./skills/serve-tools-signal-webtransport/SKILL.md).

## License

[MIT-0](./LICENSE.md)
