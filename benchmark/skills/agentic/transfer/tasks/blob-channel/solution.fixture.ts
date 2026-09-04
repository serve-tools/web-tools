import type { SubscriptionContext } from "@serve-tools/client-messaging";
import { connect, serve, transfer } from "@serve-tools/client-messaging";

interface Stats {
	readonly count: number;
	readonly bytes: number;
	readonly version: number;
}

interface BlobProtocol {
	requests: {
		put(input: { readonly key: string; readonly bytes: Uint8Array }): number;
		get(key: string): ArrayBuffer | null;
	};
	subscriptions: {
		stats(): Stats;
	};
}

export async function openBlobChannel(initial: Iterable<readonly [string, Uint8Array]> = []) {
	if (initial == null || typeof initial[Symbol.iterator] !== "function") {
		throw new TypeError("Expected iterable blobs");
	}

	const blobs = new Map<string, Uint8Array>();

	for (const entry of initial) {
		if (!Array.isArray(entry) || entry.length !== 2) {
			throw new TypeError("Invalid blob entry");
		}

		const [key, bytes] = entry;

		validate(key, bytes);
		blobs.set(key, bytes.slice());
	}

	const { port1, port2 } = new MessageChannel();
	const listeners = new Set<SubscriptionContext<Stats>>();
	let version = 0;
	const stats = (): Stats => ({
		count: blobs.size,
		bytes: Array.from(blobs.values(), (value) => value.byteLength).reduce((sum, value) => sum + value, 0),
		version,
	});
	const server = serve<BlobProtocol>(port1, {
		requests: {
			put: (input) => {
				if (!isRecord(input)) {
					throw new TypeError("Invalid put input");
				}

				validate(input.key, input.bytes);
				blobs.set(input.key, input.bytes.slice());
				++version;

				const next = stats();

				for (const listener of listeners) {
					listener.emit(next);
				}

				return version;
			},
			get: (key) => {
				if (typeof key !== "string" || key.length === 0) {
					throw new TypeError("Invalid key");
				}

				const stored = blobs.get(key);

				if (!stored) {
					return null;
				}

				const copy = stored.slice();

				return transfer(copy.buffer, [copy.buffer]);
			},
		},
		subscriptions: {
			stats: (_input, context) => {
				listeners.add(context);
				context.emit(stats());

				return () => listeners.delete(context);
			},
		},
	});
	const client = connect<BlobProtocol>(port2);

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
		put: (key: string, bytes: Uint8Array) => client.request("put", { key, bytes }),
		get: (key: string) => client.request("get", key),
		subscribe: (listener: (value: Stats) => void) => client.subscribe("stats", listener),
		close,
		closed,
	};
}

function validate(key: unknown, bytes: unknown): asserts key is string {
	if (typeof key !== "string" || key.length === 0 || !(bytes instanceof Uint8Array)) {
		throw new TypeError("Invalid blob");
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
