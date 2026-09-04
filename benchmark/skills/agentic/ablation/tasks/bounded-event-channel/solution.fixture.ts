import { MessageChannel } from "node:worker_threads";
import { connect, serve } from "@serve-tools/client-messaging";

interface Protocol {
	requests: {
		append(input: { topic: string; value: number }): void;
		list(topic: string): Array<{ topic: string; value: number }>;
	};
	subscriptions: { watch(topic: string): { topic: string; value: number } };
}

export async function openEventChannel(initial: Iterable<{ topic: string; value: number }> = []) {
	const records = Array.from(initial, (record) => {
		if (!record || typeof record.topic !== "string" || !record.topic || !Number.isFinite(record.value)) {
			throw new TypeError("record");
		}
		return { topic: record.topic, value: record.value };
	});
	const channel = new MessageChannel();
	const watchers = new Set<{ topic: string; emit(value: { topic: string; value: number }): void }>();
	const server = serve<Protocol>(channel.port1, {
		requests: {
			append(input) {
				if (!input || typeof input.topic !== "string" || !input.topic || !Number.isFinite(input.value)) {
					throw new TypeError("input");
				}
				const record = { topic: input.topic, value: input.value };
				records.push(record);
				for (const watcher of watchers) {
					if (watcher.topic === input.topic) {
						watcher.emit({ ...record });
					}
				}
			},
			list(topic) {
				if (typeof topic !== "string" || !topic) {
					throw new TypeError("topic");
				}
				return records.filter((record) => record.topic === topic).map((record) => ({ ...record }));
			},
		},
		subscriptions: {
			watch(topic, { emit }) {
				if (typeof topic !== "string" || !topic) {
					throw new TypeError("topic");
				}
				const watcher = { topic, emit };
				watchers.add(watcher);
				return () => watchers.delete(watcher);
			},
		},
	});
	const client = connect<Protocol>(channel.port2);
	await client.ready;

	return {
		append(topic: string, value: number) {
			return client.request("append", { topic, value });
		},
		list(topic: string) {
			return client.request("list", topic);
		},
		watch(topic: string, listener: (value: { topic: string; value: number }) => void) {
			if (typeof topic !== "string" || !topic || typeof listener !== "function") {
				throw new TypeError("watch");
			}
			return client.subscribe("watch", topic, listener);
		},
		close(reason?: unknown) {
			client.close(reason);
			server.close(reason);
			channel.port1.close();
			channel.port2.close();
		},
		closed: Promise.all([client.closed, server.closed]).then(() => {}),
	};
}
