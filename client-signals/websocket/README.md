# @serve-tools/signal-websocket

`@serve-tools/signal-websocket` observes a typed `@serve-tools/client-websocket` subscription as explicit Signal state.
It reuses the signal messaging observation engine, so the adapter adds no independent subscription runtime.

```ts
import { observe } from "@serve-tools/signal-websocket";

using presence = observe(client, "presence", { input: "lobby" });
```

The state is `pending`, `ready`, `complete`, or `error`.
Signal consumers may coalesce intermediate values; use `client.subscribe()` when every event must be processed.

The package Skill is at [`skills/serve-tools-signal-websocket`](./skills/serve-tools-signal-websocket/SKILL.md).
