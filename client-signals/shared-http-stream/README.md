# @serve-tools/signal-shared-http-stream

`@serve-tools/signal-shared-http-stream` observes subscriptions from a SharedWorker-coordinated HTTP stream client as explicit Signal state.

```shell
npm install @serve-tools/client-shared-http-stream @serve-tools/signal-shared-http-stream
```

Use `listen()` from the shared client package in the worker, `connect()` in each page, and `observe()` here for latest-state UI consumption.
Dispose each observation before closing its page client.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-shared-http-stream`](./skills/serve-tools-signal-shared-http-stream/SKILL.md).

## License

[MIT-0](./LICENSE.md)
