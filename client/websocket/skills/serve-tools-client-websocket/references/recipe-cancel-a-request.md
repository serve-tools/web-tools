# Recipe: cancel a request

```ts
const workspace = await client.request("openWorkspace", { id: "workspace-1" }, {
	signal: requestSignal,
});
const serverTime = await client.request("getServerTime", undefined, { signal: requestSignal });
```

Use `undefined` to preserve the input position for a zero-input operation with options.
Aborting rejects with the signal's reason and sends cancellation when possible.
Concurrent requests may settle out of order.
The package never replays requests; an application reconnect policy may recreate only operations whose server contract makes retries safe, usually through idempotency keys.
