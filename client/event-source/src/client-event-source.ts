/// <reference lib="esnext.disposable" />

import type * as T from "./lib/types.js";
import type {
	Client,
	ConnectOptions,
	EventMap,
	EventMapDefinition,
	EventMessage,
	JSONValue,
	Subscription,
} from "./lib/types.js";

const noop = (): void => {};
const inactiveSubscription: Subscription = Object.freeze({ active: false, unsubscribe: noop, [Symbol.dispose]: noop });

/** Opens a typed JSON view over a native `EventSource`. */
export const connect = <const Events extends EventMap & EventMapDefinition<Events>>(
	url: string | URL,
	options: ConnectOptions = {},
): Client<Events> => {
	const source = new EventSource(
		url,
		options.withCredentials === undefined ? undefined : { withCredentials: options.withCredentials },
	);
	const closed = Promise.withResolvers<void>();
	const subscriptions = new Set<() => void>();

	let isClosed = false;

	const close = (): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		options.signal?.removeEventListener("abort", close);

		source.removeEventListener("error", closeIfFailed);

		for (const unsubscribe of [...subscriptions]) {
			unsubscribe();
		}

		source.close();
		closed.resolve();
	};

	const closeIfFailed = (): void => {
		if (source.readyState === EventSource.CLOSED) {
			close();
		}
	};

	options.signal?.addEventListener("abort", close, { once: true });

	source.addEventListener("error", closeIfFailed);

	if (options.signal?.aborted) {
		close();
	}

	return {
		source,
		closed: closed.promise,
		subscribe(name: string, listener: (event: EventMessage<JSONValue>) => void, subscribeOptions = {}) {
			if (isClosed || subscribeOptions.signal?.aborted) {
				return inactiveSubscription;
			}

			let active = true;

			const receive = (rawEvent: Event): void => {
				const event = rawEvent as MessageEvent<string>;

				let data: JSONValue;

				try {
					data = JSON.parse(event.data) as JSONValue;
				} catch (error) {
					reportError(error);

					return;
				}

				listener({ type: event.type, data, lastEventId: event.lastEventId, origin: event.origin });
			};

			const unsubscribe = (): void => {
				if (!active) {
					return;
				}

				active = false;

				subscriptions.delete(unsubscribe);
				source.removeEventListener(name, receive);
				subscribeOptions.signal?.removeEventListener("abort", unsubscribe);
			};

			source.addEventListener(name, receive);

			subscriptions.add(unsubscribe);

			subscribeOptions.signal?.addEventListener("abort", unsubscribe, { once: true });

			return {
				get active() {
					return active;
				},
				unsubscribe,
				[Symbol.dispose]: unsubscribe,
			};
		},
		close,
		[Symbol.dispose]: close,
	} as Client<Events>;
};

/** Types used by {@link connect}. */
export namespace connect {
	export type Client<Events extends T.EventMap = T.EventMap> = T.Client<Events>;
	export type EventMap = T.EventMap;
	export type EventMapType<Value> = T.EventMapType<Value>;
	export type EventMessage<Value extends T.JSONValue = T.JSONValue> = T.EventMessage<Value>;
	export type JSONValue = T.JSONValue;
	export type Options = T.ConnectOptions;
	export type SubscribeOptions = T.SubscribeOptions;
	export type Subscription = T.Subscription;
}

export type * from "./lib/types.js";
