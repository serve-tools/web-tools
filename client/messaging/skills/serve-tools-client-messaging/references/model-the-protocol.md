# Model the protocol

1. Declare named operations as callable methods with zero parameters or one structured input parameter.
2. Use the optional `requests` section for one promised result and the optional `subscriptions` section for ordered values over time.
3. Omit an unused section instead of declaring an empty record.
4. Treat a request response as `Awaited<ReturnType<Operation>>` and each subscription event as the raw `ReturnType<Operation>`.

Model finite work as requests and repeated occurrences as subscriptions.

```ts
interface Protocol {
	requests: {
		status(): Status;
		save(input: SaveInput): Revision | Promise<Revision>;
	};
	subscriptions: {
		changes(projectID: string): Change;
	};
}
```

Call a zero-input request as `client.request("status")` and pass `undefined` before options when needed.
Call a zero-input subscription as `client.subscribe("updates", onUpdate, options)` without an input placeholder.
For a one-input operation, pass the input immediately after its name.
