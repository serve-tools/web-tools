# @serve-tools/signal-shared-webtransport

`@serve-tools/signal-shared-webtransport` provides the shared WebTransport client together with reliable subscription Signal state.

```shell
npm install @serve-tools/signal-shared-webtransport
```

Use `listen()` from `/scope/shared-worker`, then import `connect()` and `observe()` together from the package root or `/scope/window`.
Use the raw shared datagram API for best-effort occurrences.
Dispose each observation before closing its page client; neither action closes the worker-owned physical session for other pages.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-shared-webtransport`](./skills/serve-tools-signal-shared-webtransport/SKILL.md).

## License

[MIT-0](./LICENSE.md)
