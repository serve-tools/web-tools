import { connect as connectPort } from "@serve-tools/client-messaging";
import type * as T from "./.types.js";
import type {
	BridgeProtocol,
	EventMap,
	EventMapDefinition,
	EventMessage,
	JSONValue,
	SharedEventSourceClient,
	SubscribeOptions,
	Subscription,
} from "./.types.js";

/** Connects a page client to the native EventSource owned by a shared worker. */
export const connect = <const Events extends EventMap & EventMapDefinition<Events>>(
	port: MessagePort,
): SharedEventSourceClient<Events> => {
	const client = connectPort<BridgeProtocol>(port);

	return {
		subscribe(
			name: string,
			listener: (event: EventMessage<JSONValue>) => void,
			options?: SubscribeOptions,
		): Subscription {
			return client.subscribe("event", { name }, listener, options);
		},
		closed: client.closed,
		close: client.close,
		[Symbol.dispose]: client[Symbol.dispose],
	} as SharedEventSourceClient<Events>;
};

/** Types used by {@link connect}. */
export namespace connect {
	export type Client<Events extends T.EventMap = T.EventMap> = T.SharedEventSourceClient<Events>;
	export type EventMap = T.EventMap;
	export type EventMapType<Value> = T.EventMapType<Value>;
	export type EventMessage<Value extends T.JSONValue = T.JSONValue> = T.EventMessage<Value>;
	export type JSONValue = T.JSONValue;
	export type SubscribeOptions = T.SubscribeOptions;
	export type Subscription = T.Subscription;
}
