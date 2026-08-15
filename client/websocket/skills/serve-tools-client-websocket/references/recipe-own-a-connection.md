# Recipe: own a connection

```ts
import { connect } from "@serve-tools/client-websocket";

await using client = await connect<WorkspaceProtocol>("wss://example.com/workspaces", {
	protocols: ["workspaces.v1"],
	signal: openingSignal,
});
```

`protocols` selects native handshake subprotocols, while `signal` cancels only the opening handshake.
Await `client.closed` as a terminal cleanup barrier, not as evidence that operations succeeded.
