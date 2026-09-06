import { connect as connectPort } from "@serve-tools/client-messaging";
import type * as T from "./_types.js";
import type {
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SharedWebTransportBridgeProtocol,
	SharedWebTransportClient,
	SubscribeOptions,
	Subscription,
} from "./_types.js";

/** Connects a typed page client to a WebTransport session owned by a `SharedWorker`. */
export const connect = <const P extends Protocol & ProtocolDefinition<P>>(
	port: MessagePort,
): SharedWebTransportClient<P> => {
	const client = connectPort<SharedWebTransportBridgeProtocol>(port);
	const pendingReads = new Set<(reason: unknown) => void>();
	const maxDatagramSize = client.request("datagramMaximumSize");

	let datagramsClosed: Error | undefined;

	void maxDatagramSize.catch(() => undefined);

	const datagrams = {
		maxDatagramSize,
		write: (name: string, value: unknown): Promise<void> => client.request("datagramWrite", { name, value }),
		subscribe: (name: string, listener: (value: unknown) => void): Subscription =>
			client.subscribe("datagramSubscribe", { name }, listener),
		read(name: string, options: { readonly signal?: AbortSignal } = {}): Promise<unknown> {
			if (datagramsClosed) {
				return Promise.reject(datagramsClosed);
			}

			if (options.signal?.aborted) {
				return Promise.reject(options.signal.reason);
			}

			return new Promise((resolve, reject) => {
				const finish = (): void => {
					subscription.unsubscribe();
					pendingReads.delete(close);
					options.signal?.removeEventListener("abort", abort);
				};
				const close = (reason: unknown): void => {
					finish();
					reject(reason);
				};
				const abort = (): void => close(options.signal?.reason);

				const subscription: Subscription = datagrams.subscribe(name, (value) => {
					finish();
					resolve(value);
				});

				pendingReads.add(close);

				options.signal?.addEventListener("abort", abort, { once: true });
			});
		},
	};

	void client.closed.then(() => {
		datagramsClosed = Object.assign(new Error("The connection is closed"), { name: "ConnectionClosedError" });

		for (const close of pendingReads) {
			close(datagramsClosed);
		}
	});

	return {
		request(name: string, input?: unknown, options: RequestOptions = {}): Promise<unknown> {
			return client.request("request", { name, input }, options);
		},
		subscribe(
			name: string,
			inputOrListener: unknown,
			listenerOrOptions?: ((value: unknown) => void) | SubscribeOptions,
			maybeOptions?: SubscribeOptions,
		): Subscription {
			const noInput = typeof inputOrListener === "function";
			const input = noInput ? undefined : inputOrListener;
			const listener = (noInput ? inputOrListener : listenerOrOptions) as (value: unknown) => void;
			const options = (noInput ? listenerOrOptions : maybeOptions) as SubscribeOptions | undefined;

			return client.subscribe("subscribe", { name, input }, listener, options);
		},
		datagrams,
		closed: client.closed,
		close: client.close,
		[Symbol.dispose]: client[Symbol.dispose],
	} as SharedWebTransportClient<P>;
};

/** Types used by {@link connect}. */
export namespace connect {
	/** A typed page client for a worker-owned WebTransport session. */
	export type Client<P extends T.Protocol = T.Protocol> = T.SharedWebTransportClient<P>;

	/** Typed best-effort datagrams routed through the worker-owned session. */
	export type Datagrams<P extends T.Protocol> = T.SharedClientDatagrams<P>;

	/** A compile-time collection of reliable operations and datagram channels. */
	export type Protocol = T.Protocol;

	/** Extracts the protocol retained by a shared WebTransport client or server. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** Options for sending and cancelling a reliable request. */
	export type RequestOptions = T.RequestOptions;

	/** Options for cancelling or observing a reliable subscription. */
	export type SubscribeOptions = T.SubscribeOptions;

	/** A disposable handle for one active page-local subscription. */
	export type Subscription = T.Subscription;
}
