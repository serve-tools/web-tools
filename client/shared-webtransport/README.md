# @serve-tools/client-shared-webtransport

Send reliable operations and best-effort datagrams from several tabs over one worker-owned WebTransport session.

Call `listen()` in the worker and `connect(worker.port)` in each page.
Reliable requests and subscriptions retain the direct client's semantics.
Typed datagram `write()`, `subscribe()`, and `read()` operations are routed through the worker-owned session.

## Share reliable calls and cursor datagrams

Open a matching [WebTransport server](../../server/webtransport/) session in the worker and connect each page to that worker.
Same-origin tabs with the same worker URL and name share the physical session.

```ts
// realtime.worker.ts
import { listen } from "@serve-tools/client-shared-webtransport/scope/shared-worker";

const server = listen<{
	requests: { profile(id: string): { id: string; name: string } };
	datagrams: { cursor: { client: { x: number; y: number }; server: { x: number; y: number } } };
}>("https://example.com/realtime");
export type AppProtocol = listen.ProtocolType<typeof server>;
```

```ts
// page.ts
import { connect } from "@serve-tools/client-shared-webtransport/scope/window";
import type { AppProtocol } from "./realtime.worker.js";

const worker = new SharedWorker(new URL("./realtime.worker.js", import.meta.url), { type: "module" });
const client = connect<AppProtocol>(worker.port);
const cursors = client.datagrams.subscribe("cursor", (cursor) => console.log(cursor.x, cursor.y));

addEventListener("pagehide", () => {
	cursors.unsubscribe();
	client.close();
	worker.port.close();
});
console.log((await client.request("profile", "ada")).name);
await client.datagrams.write("cursor", { x: 20, y: 40 });
```

The profile request reliably returns a name; datagrams publish best-effort cursor coordinates and may be lost.
Closing one page client leaves other pages active.
Next, call `client.datagrams.read("cursor")` to await one future arrival, or await `maxDatagramSize` for the worker-owned native limit.
Use [direct WebTransport](../webtransport/) when the page needs its own session or independently scheduled native writable.

The page connection closes on every `pagehide`, including when entering the back/forward cache.
On a persisted `pageshow`, create a fresh worker port, client, and subscriptions using the [mount and restore recipe](../messaging/#backforward-cache).

## Install

```shell
npm install @serve-tools/client-shared-webtransport
```

#### Import from a CDN

```js
import * as clientSharedWebtransport from "https://esm.run/@serve-tools/client-shared-webtransport";
```

The worker owns the physical session, reliable streams, datagram registry, and native datagram writer.
Each page owns its logical client, subscriptions, and port.
`maxDatagramSize` is a Promise because the native value is worker-owned.
Pending `read()` calls reject and remove their page-local subscriptions when either the page client or worker-owned session closes.
The shared client intentionally does not expose `createWritable()` because native WebTransport scheduling groups and writable ownership cannot retain their semantics across a `MessagePort`.

Datagrams remain best-effort and unbuffered.
The package does not add reconnection, replay, persistence, resumption, or Media over QUIC sharing.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-shared-webtransport`](./skills/serve-tools-client-shared-webtransport/SKILL.md).

## License

[MIT-0](./LICENSE.md)
