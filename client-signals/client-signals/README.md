# @serve-tools/client-signals

`@serve-tools/client-signals` provides namespaces and focused subpaths for every Serve Tools signal-aware client package.

```ts
import { sharedWebsocket, websocket } from "@serve-tools/client-signals";

const direct = websocket.observe(socket, "updates");
const shared = sharedWebsocket.observe(sharedSocket, "updates");
```

Focused imports such as `@serve-tools/client-signals/websocket` re-export the underlying package.

The package Skill is at [`skills/serve-tools-client-signals`](./skills/serve-tools-client-signals/SKILL.md).
