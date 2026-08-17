# @serve-tools/signal-shared-http-stream

`@serve-tools/signal-shared-http-stream` provides the SharedWorker HTTP stream client together with subscription Signal state.

```shell
npm install @serve-tools/signal-shared-http-stream
```

Use `listen()` from `/scope/shared-worker`, then import `connect()` and `observe()` together from the package root or `/scope/window`.
Dispose each observation before closing its page client.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-shared-http-stream`](./skills/serve-tools-signal-shared-http-stream/SKILL.md).

## License

[MIT-0](./LICENSE.md)
