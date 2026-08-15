# Recipe: scope a subscription

```ts
using changes = client.subscribe("workspaceChanged", { id: workspace.id }, applyChange, {
	signal: subscriptionSignal,
	onComplete: markComplete,
	onError: showConnectionError,
});
using announcements = client.subscribe("announcements", undefined, displayAnnouncement);
```

Disposal, unsubscribe, and abort are idempotent local cancellations and do not call terminal callbacks.
Remote completion calls `onComplete`; remote, transport, and protocol failures call `onError` or fall back to `reportError()`.
