# @serve-tools/client-shared-webtransport

`@serve-tools/client-shared-webtransport` shares one typed WebTransport session across pages through a `SharedWorker`.

Call `listen()` in the worker and `connect(worker.port)` in each page.
Reliable requests and subscriptions retain the direct client's semantics.
Typed datagram `write()`, `subscribe()`, and `read()` operations are routed through the worker-owned session.

## Install

```shell
npm install @serve-tools/client-shared-webtransport
```

The worker owns the physical session, reliable streams, datagram registry, and native datagram writer.
Each page owns its logical client, subscriptions, and port.
`maxDatagramSize` is a Promise because the native value is worker-owned.
The shared client intentionally does not expose `createWritable()` because native WebTransport scheduling groups and writable ownership cannot retain their semantics across a `MessagePort`.

Datagrams remain best-effort and unbuffered.
The package does not add reconnection, replay, persistence, resumption, or Media over QUIC sharing.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-shared-webtransport`](./skills/serve-tools-client-shared-webtransport/SKILL.md).

## License

[MIT-0](./LICENSE.md)
