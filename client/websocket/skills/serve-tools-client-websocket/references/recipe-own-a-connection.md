# Recipe: own a connection

```ts
import { connect } from "@serve-tools/client-websocket";

await using client = await connect<WorkspaceProtocol>("wss://example.com/workspaces", {
	signal: openingSignal,
});
```

The package offers and requires the `serve-tools.realtime.v1` native subprotocol.
`signal` cancels the opening handshake and remains the established client's lifetime signal.
Await `client.closed` as a terminal cleanup barrier, not as evidence that operations succeeded.
