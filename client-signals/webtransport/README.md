# @serve-tools/signal-webtransport

`@serve-tools/signal-webtransport` observes reliable typed WebTransport subscriptions as explicit Signal state.

```ts
import { observe } from "@serve-tools/signal-webtransport";

const presence = observe(client, "presence", { input: { room: "lobby" } });
```

## Install

```shell
npm install @serve-tools/client-webtransport @serve-tools/signal-webtransport
```

The adapter applies to reliable subscriptions, not best-effort datagrams.
Use the client's datagram API when every arriving datagram occurrence matters.
Dispose observations independently from the WebTransport client.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-webtransport`](./skills/serve-tools-signal-webtransport/SKILL.md).

## License

[MIT-0](./LICENSE.md)
