import { connect as connectPort } from "@serve-tools/client-messaging";
import type * as T from "./.types.js";
import type {
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SharedHTTPStreamBridgeProtocol,
	SharedHTTPStreamClient,
	SubscribeOptions,
	Subscription,
} from "./.types.js";

/** Connects a typed page client to HTTP exchanges coordinated by a `SharedWorker`. */
export const connect = <const P extends Protocol & ProtocolDefinition<P>>(
	port: MessagePort,
): SharedHTTPStreamClient<P> => {
	const client = connectPort<SharedHTTPStreamBridgeProtocol>(port);

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
	} as SharedHTTPStreamClient<P>;
};

export namespace connect {
	export type Client<P extends T.Protocol = T.Protocol> = T.SharedHTTPStreamClient<P>;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type RequestOptions = T.RequestOptions;
	export type SubscribeOptions = T.SubscribeOptions;
	export type Subscription = T.Subscription;
}
