import { connect as connectPort } from "@serve-tools/client-messaging";
import type * as T from "./.types.js";
import type {
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SharedWebSocketBridgeProtocol,
	SharedWebSocketClient,
	SubscribeOptions,
	Subscription,
} from "./.types.js";

/** Connects a typed client to the physical WebSocket owned by a `SharedWorker`. */
export const connect = <const P extends Protocol & ProtocolDefinition<P>>(
	port: MessagePort,
): SharedWebSocketClient<P> => {
	const client = connectPort<SharedWebSocketBridgeProtocol>(port);

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

		closed: client.closed,
		close: client.close,
		[Symbol.dispose]: client[Symbol.dispose],
	} as SharedWebSocketClient<P>;
};

/** Types used by {@link connect}. */
export namespace connect {
	/** Extracts the protocol retained by a shared WebSocket resource. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** Options for sending and cancelling a request. */
	export type RequestOptions = T.RequestOptions;

	/** A typed client whose physical WebSocket is owned by a `SharedWorker`. */
	export type Client<P extends T.Protocol = T.Protocol> = T.SharedWebSocketClient<P>;

	/** Options for sending, cancelling, and observing a subscription. */
	export type SubscribeOptions = T.SubscribeOptions;

	/** A disposable handle for one active subscription. */
	export type Subscription = T.Subscription;
}
