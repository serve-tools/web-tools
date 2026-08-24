import { listen as listenForMessages } from "@serve-tools/client-messaging/scope/worker";
import { connect as connectWebTransport } from "@serve-tools/client-webtransport";
import type * as T from "./.types.js";
import type {
	ConnectOptions,
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SharedWebTransportBridgeProtocol,
	SharedWebTransportServer,
	SubscribeOptions,
	Subscription,
} from "./.types.js";

type UntypedClient = {
	request(name: string, input: unknown, options: RequestOptions): Promise<unknown>;
	subscribe(
		name: string,
		input: unknown,
		listener: (value: unknown) => void,
		options: SubscribeOptions,
	): Subscription;
	datagrams: {
		readonly maxDatagramSize: number;
		write(name: string, value: unknown): Promise<void>;
		subscribe(name: string, listener: (value: unknown) => void): Subscription;
	};
	readonly closed: Promise<void>;
	close(reason?: unknown): void;
};

const noop = (): void => {};

/** Opens one WebTransport session and serves it to every port connected to this `SharedWorker`. */
export const listen = <const P extends Protocol & ProtocolDefinition<P>>(
	url: string | URL,
	options: ConnectOptions = {},
): SharedWebTransportServer<P> => {
	const controller = new AbortController();
	const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
	const webtransport = connectWebTransport<P>(url, { ...options, signal });
	const client = webtransport as unknown as Promise<UntypedClient>;

	void client.catch(noop);

	const connections = listenForMessages<SharedWebTransportBridgeProtocol>({
		requests: {
			request: async ({ name, input }, { signal: operationSignal }) =>
				(await client).request(name, input, { signal: operationSignal }),
			datagramWrite: async ({ name, value }) => (await client).datagrams.write(name, value),
			datagramMaximumSize: async () => (await client).datagrams.maxDatagramSize,
		},
		subscriptions: {
			subscribe: async ({ name, input }, { emit, complete, error, signal: operationSignal }) => {
				const current = await client;

				if (operationSignal.aborted) {
					return;
				}

				const subscription = current.subscribe(name, input, emit, {
					signal: operationSignal,
					onComplete: complete,
					onError: error,
				});

				return subscription.unsubscribe;
			},
			datagramSubscribe: async ({ name }, { emit, signal: operationSignal }) => {
				const current = await client;

				if (operationSignal.aborted) {
					return;
				}

				const subscription = current.datagrams.subscribe(name, emit);
				operationSignal.addEventListener("abort", subscription.unsubscribe, { once: true });

				return subscription.unsubscribe;
			},
		},
	});
	const closed = Promise.withResolvers<void>();
	let isClosed = false;

	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;
		connections.close(reason);
		controller.abort(reason);
		void client.then((current) => current.close(reason), noop);
		closed.resolve();
	};

	void client.then((current) => void current.closed.then(close), close);

	return { webtransport, closed: closed.promise, close, [Symbol.dispose]: close };
};

/** Types used by {@link listen}. */
export namespace listen {
	/** Options for opening the worker-owned WebTransport session. */
	export type Options = T.ConnectOptions;

	/** A compile-time collection of reliable operations and datagram channels. */
	export type Protocol = T.Protocol;

	/** Extracts the protocol retained by a shared WebTransport client or server. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** A worker-owned WebTransport session and its attached page connections. */
	export type Server<P extends T.Protocol = T.Protocol> = T.SharedWebTransportServer<P>;
}
