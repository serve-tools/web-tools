import type { SubscriptionContext } from "@serve-tools/client-messaging";
import { connect, serve, transfer } from "@serve-tools/client-messaging";

interface DocumentProtocol {
	requests: {
		read(): string;
		replace(text: string): number;
		bytes(): ArrayBuffer;
	};
	subscriptions: {
		changes(): { readonly text: string; readonly version: number };
	};
}

export async function openDocumentChannel(initialText = "") {
	if (typeof initialText !== "string") {
		throw new TypeError("Expected initial text");
	}

	const { port1, port2 } = new MessageChannel();
	const listeners = new Set<SubscriptionContext<{ readonly text: string; readonly version: number }>>();

	let text = initialText;
	let version = 0;

	const server = serve<DocumentProtocol>(port1, {
		requests: {
			read: () => text,
			replace: (next) => {
				if (typeof next !== "string") {
					throw new TypeError("Expected text");
				}

				text = next;
				++version;

				for (const listener of listeners) {
					listener.emit({ text, version });
				}

				return new TextEncoder().encode(text).byteLength;
			},
			bytes: () => {
				const bytes = new TextEncoder().encode(text);

				return transfer(bytes.buffer, [bytes.buffer]);
			},
		},
		subscriptions: {
			changes: (_input, context) => {
				listeners.add(context);
				context.emit({ text, version });

				return () => listeners.delete(context);
			},
		},
	});
	const client = connect<DocumentProtocol>(port2);

	await client.ready;

	let open = true;
	const closed = Promise.all([client.closed, server.closed]).then(() => undefined);
	const close = (reason?: unknown): void => {
		if (!open) {
			return;
		}

		open = false;
		client.close(reason);
		server.close(reason);
		port1.close();
		port2.close();
	};

	return {
		read: () => client.request("read"),
		replace: (next: string) => client.request("replace", next),
		bytes: () => client.request("bytes"),
		subscribe: (listener: (value: { readonly text: string; readonly version: number }) => void) =>
			client.subscribe("changes", listener),
		close,
		closed,
	};
}
