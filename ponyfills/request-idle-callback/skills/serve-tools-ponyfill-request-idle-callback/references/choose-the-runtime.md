# Choose the runtime

- Use the package root in a browser with `document` and `requestAnimationFrame`.
- Use `@serve-tools/ponyfill-request-idle-callback/runtime/node` in Node.js.
- Use `@serve-tools/ponyfill-request-idle-callback/runtime/bun` in Bun.
- Use `@serve-tools/ponyfill-request-idle-callback/runtime/deno` in Deno.

Each runtime export owns a separate queue and cancellation domain.
The server schedulers use unreferenced handles, so pending idle work does not keep the process alive.
Node.js uses recent event-loop utilization to postpone idle work under load; Bun and Deno use their native immediate scheduling directly.
