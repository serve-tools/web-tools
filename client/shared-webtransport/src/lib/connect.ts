import { connect as connectPort } from "@serve-tools/client-messaging";
import type * as T from "./.types.js";
import type {
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SharedWebTransportBridgeProtocol,
	SharedWebTransportClient,
	SubscribeOptions,
	Subscription,
} from "./.types.js";

/** Connects a typed page client to a WebTransport session owned by a `SharedWorker`. */
export const connect = <const P extends Protocol & ProtocolDefinition<P>>(
	port: MessagePort,
): SharedWebTransportClient<P> => {
	const client = connectPort<SharedWebTransportBridgeProtocol>(port);
	const datagrams = {
		maxDatagramSize: client.request("datagramMaximumSize"),
		write: (name: string, value: unknown): Promise<void> => client.request("datagramWrite", { name, value }),
		subscribe: (name: string, listener: (value: unknown) => void): Subscription =>
			client.subscribe("datagramSubscribe", { name }, listener),
		read(name: string, options: { readonly signal?: AbortSignal } = {}): Promise<unknown> {
			if (options.signal?.aborted) {
				return Promise.reject(options.signal.reason);
			}

			return new Promise((resolve, reject) => {
				let subscription: Subscription;

				const abort = (): void => {
					subscription.unsubscribe();

					reject(options.signal?.reason);
				};

				subscription = datagrams.subscribe(name, (value) => {
					subscription.unsubscribe();

					options.signal?.removeEventListener("abort", abort);

					resolve(value);
				});

				options.signal?.addEventListener("abort", abort, { once: true });
			});
		},
	};

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

export namespace connect {
	export type Client<P extends T.Protocol = T.Protocol> = T.SharedWebTransportClient<P>;
	export type Datagrams<P extends T.Protocol> = T.SharedClientDatagrams<P>;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type RequestOptions = T.RequestOptions;
	export type SubscribeOptions = T.SubscribeOptions;
	export type Subscription = T.Subscription;
}
