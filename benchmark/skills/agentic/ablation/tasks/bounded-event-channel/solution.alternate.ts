import { connect, serve } from "@serve-tools/client-messaging";

type RecordValue = { readonly topic: string; readonly value: number };
type Channel = {
	requests: { append(input: RecordValue): void; list(topic: string): RecordValue[] };
	subscriptions: { watch(topic: string): RecordValue };
};

export async function openEventChannel(initial: readonly RecordValue[] = []) {
	const records = copyRecords(initial);
	const bus = new EventTarget();
	const channel = new MessageChannel();
	const server = serve<Channel>(channel.port1, {
		requests: {
			append(input) {
				assertRecord(input);
				const record = { topic: input.topic, value: input.value };
				records.push(record);
				bus.dispatchEvent(new CustomEvent("record", { detail: record }));
			},
			list(topic) {
				assertTopic(topic);
				return records.filter((record) => record.topic === topic).map((record) => ({ ...record }));
			},
		},
		subscriptions: {
			watch(topic, { emit, signal }) {
				assertTopic(topic);
				const listener = (event: Event): void => {
					const record = (event as CustomEvent<RecordValue>).detail;
					if (record.topic === topic) {
						emit({ ...record });
					}
				};
				bus.addEventListener("record", listener);
				signal.addEventListener("abort", () => bus.removeEventListener("record", listener), { once: true });
				return () => bus.removeEventListener("record", listener);
			},
		},
	});
	const client = connect<Channel>(channel.port2);
	await client.ready;
	return {
		append: async (topic: string, value: number): Promise<void> => {
			await client.request("append", { topic, value });
		},
		list: (topic: string): Promise<RecordValue[]> => client.request("list", topic),
		watch(topic: string, listener: (record: RecordValue) => void) {
			if (typeof listener !== "function") {
				throw new TypeError("Expected a listener");
			}
			const subscription = client.subscribe("watch", topic, listener);
			return { unsubscribe: () => subscription.unsubscribe() };
		},
		close(reason?: unknown): void {
			client.close(reason);
			server.close(reason);
			channel.port1.close();
			channel.port2.close();
		},
		closed: Promise.all([client.closed, server.closed]).then(() => undefined),
	};
}

function copyRecords(value: Iterable<RecordValue>): RecordValue[] {
	if (value === null || value === undefined || typeof value[Symbol.iterator] !== "function") {
		throw new TypeError("Expected records");
	}
	if (Array.isArray(value) && Object.keys(value).length !== value.length) {
		throw new TypeError("Expected dense records");
	}
	return Array.from(value, (record) => {
		assertRecord(record);
		return { topic: record.topic, value: record.value };
	});
}

function assertRecord(value: unknown): asserts value is RecordValue {
	if (typeof value !== "object" || value === null) {
		throw new TypeError("Expected a record");
	}
	assertTopic((value as RecordValue).topic);
	if (!Number.isFinite((value as RecordValue).value)) {
		throw new TypeError("Expected a finite value");
	}
}

function assertTopic(topic: unknown): asserts topic is string {
	if (typeof topic !== "string" || topic.length === 0) {
		throw new TypeError("Expected a topic");
	}
}
