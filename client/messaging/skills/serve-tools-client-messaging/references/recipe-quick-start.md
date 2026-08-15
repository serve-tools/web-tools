# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-messaging.recipes.ts` fixture in the package source.

```ts
/// <reference lib="esnext.disposable" />

import type { Handlers, MessageEndpoint } from "@serve-tools/client-messaging";
import { connect, serve, transfer } from "@serve-tools/client-messaging";

type FilesProtocol = {
	requests: {
		bytes(path: string): ArrayBuffer;
	};
	subscriptions: {
		progress(path: string): number;
	};
};

const handlers = {
	requests: {
		bytes: (_path) => {
			const buffer = new ArrayBuffer(16);
			return transfer(buffer, [buffer]);
		},
	},
	subscriptions: {
		progress: (_path, { emit, signal }) => {
			emit(0);
			if (!signal.aborted) emit(1);
		},
	},
} satisfies Handlers<FilesProtocol>;

/** A compile-tested request, subscription, transfer, and disposal recipe. */
export async function messagePortRecipe(
	clientEndpoint: MessageEndpoint,
	serverEndpoint: MessageEndpoint,
	signal: AbortSignal,
): Promise<ArrayBuffer> {
	using _server = serve<FilesProtocol>(serverEndpoint, handlers);
	using client = connect<FilesProtocol>(clientEndpoint);
	using _progress = client.subscribe("progress", "report.pdf", console.log, { signal });

	return client.request("bytes", "report.pdf", { signal });
}
```
