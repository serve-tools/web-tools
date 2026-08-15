# Recipe: model named operations

Declare optional `requests` and `subscriptions` records whose operations accept zero or one input.
The return type is the response or each event, and promise-like return types are unwrapped.

```ts
interface WorkspaceProtocol {
	requests: {
		openWorkspace: (input: { id: string }) => Promise<{ id: string; title: string }>;
		getServerTime: () => Date;
	};
	subscriptions: {
		workspaceChanged: (input: { id: string }) => { revision: number };
		announcements: () => string;
	};
}
```

Omit an unused section and prefer distinct operation names over optional inputs that simulate overloads.
