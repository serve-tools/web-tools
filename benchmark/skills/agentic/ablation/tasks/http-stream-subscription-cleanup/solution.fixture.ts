import { connect } from "@serve-tools/client-http-stream";
import { createHandler } from "@serve-tools/server-http-stream";

interface CounterProtocol {
	requests: {};
	subscriptions: { counter(input: number): number };
}

export function openCounter(input = 1): {
	values: number[];
	stop(): void;
	closed: Promise<void>;
	readonly cleanupCount: number;
} {
	if (!Number.isFinite(input)) {
		throw new TypeError("Expected a finite input");
	}

	const cleanupFinished = Promise.withResolvers<void>();
	let cleanupCount = 0;
	const handler = createHandler<CounterProtocol>({
		requests: {},
		subscriptions: {
			counter(value, { emit }) {
				emit(value);

				return () => {
					++cleanupCount;
					cleanupFinished.resolve();
				};
			},
		},
	});
	const client = connect<CounterProtocol>("https://local/counter", {
		fetch: (url, init) => handler(new Request(url, init)),
	});
	const values: number[] = [];
	const subscription = client.subscribe("counter", input, (value) => values.push(value));
	let stopped = false;
	const closed = Promise.all([client.closed, cleanupFinished.promise]).then(() => {
		handler.close();
	});

	return {
		values,
		stop() {
			if (stopped) {
				return;
			}

			stopped = true;
			subscription.unsubscribe();
			client.close();
		},
		closed,
		get cleanupCount() {
			return cleanupCount;
		},
	};
}
