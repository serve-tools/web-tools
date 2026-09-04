import { connect } from "@serve-tools/client-http-stream";
import { createHandler } from "@serve-tools/server-http-stream";

interface CounterProtocol {
	subscriptions: { counter(input: number): number };
}

export function openCounter(input = 1): {
	values: number[];
	stop: () => void;
	closed: Promise<void>;
	readonly cleanupCount: number;
} {
	if (typeof input !== "number" || !Number.isFinite(input)) {
		throw new TypeError("input must be a finite number");
	}

	let count = 0;
	const cleanup = Promise.withResolvers<void>();
	const handler = createHandler<CounterProtocol>({
		subscriptions: {
			counter(value, { emit }) {
				emit(value);
				return () => {
					++count;
					cleanup.resolve();
				};
			},
		},
	});
	const client = connect<CounterProtocol>("https://counter.invalid/stream", {
		fetch: (request, init) => handler(new Request(request, init)),
	});
	const values: number[] = [];
	const subscription = client.subscribe("counter", input, (value) => values.push(value));
	let stopped = false;
	const stop = (): void => {
		if (stopped) {
			return;
		}
		stopped = true;
		subscription.unsubscribe();
		client.close();
		handler.close();
	};
	const closed = Promise.all([client.closed, cleanup.promise]).then(() => {});

	return {
		values,
		stop,
		closed,
		get cleanupCount() {
			return count;
		},
	};
}
