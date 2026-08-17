# Choose an adapter

- Use `@serve-tools/server-websocket/runtime/node` with the optional `ws` peer for `node:http` upgrade events.
- Use root `attach()` for a runtime that has already accepted a WHATWG-compatible WebSocket, including Deno.
- Use `@serve-tools/server-websocket/runtime/bun` for `Bun.serve()` upgrade and WebSocket callbacks.
- Use `@serve-tools/server-websocket/crossws` for crossws, Nitro, Nuxt, or h3 lifecycle hooks.
- Use root `createConnection()` only when building transport glue from complete binary messages.
