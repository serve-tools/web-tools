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
	const pendingReads = new Set<(reason: unknown) => void>();
	let datagramsClosed: Error | undefined;
	const maxDatagramSize = client.request("datagramMaximumSize");

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
				let subscription: Subscription;

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

				subscription = datagrams.subscribe(name, (value) => {
					finish();
					resolve(value);
				});

				pendingReads.add(close);
				options.signal?.addEventListener("abort", abort, { once: true });
			});
		},
	};

	void client.closed.then(() => {
		datagramsClosed = connectionClosedError();

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

const connectionClosedError = (reason: unknown = "The connection is closed"): Error =>
	reason instanceof Error
		? reason
		: Object.assign(new Error(String(reason)), {
				name: "ConnectionClosedError",
			});

export namespace connect {
	export type Client<P extends T.Protocol = T.Protocol> = T.SharedWebTransportClient<P>;
	export type Datagrams<P extends T.Protocol> = T.SharedClientDatagrams<P>;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type RequestOptions = T.RequestOptions;
	export type SubscribeOptions = T.SubscribeOptions;
	export type Subscription = T.Subscription;
}
