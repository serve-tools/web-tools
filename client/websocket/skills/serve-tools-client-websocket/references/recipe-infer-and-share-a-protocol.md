# Recipe: infer and share a protocol

```ts
import type { ProtocolType } from "@serve-tools/client-websocket";

type PendingProtocol = ProtocolType<ReturnType<typeof connect<WorkspaceProtocol>>>;
type ActiveProtocol = ProtocolType<typeof client | undefined>;
```

Keep the type parameter visible at the connection boundary and extract directly from pending or resolved clients.
