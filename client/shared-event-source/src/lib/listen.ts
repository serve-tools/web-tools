import { connect as connectEventSource } from "@serve-tools/client-event-source";
import { listen as listenForMessages } from "@serve-tools/client-messaging/scope/worker";
import type * as T from "./.types.js";
import type {
	BridgeProtocol,
	ConnectOptions,
	EventMap,
	EventMapDefinition,
	EventMessage,
	JSONValue,
	SharedEventSourceServer,
} from "./.types.js";

type UntypedClient = {
	subscribe(name: string, listener: (event: EventMessage<JSONValue>) => void): { unsubscribe(): void };
};

/** Opens one native EventSource and serves its typed events to every client of this shared worker. */
export const listen = <const Events extends EventMap & EventMapDefinition<Events>>(
	url: string | URL,
	options: ConnectOptions = {},
): SharedEventSourceServer<Events> => {
	const controller = new AbortController();
	const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
	const eventSource = connectEventSource<Events>(url, { ...options, signal });
	const connections = listenForMessages<BridgeProtocol>({
		subscriptions: {
			event: ({ name }, { emit }) => (eventSource as unknown as UntypedClient).subscribe(name, emit).unsubscribe,
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
		eventSource.close();
		closed.resolve();
	};

	void eventSource.closed.then(close);

	return { eventSource, closed: closed.promise, close, [Symbol.dispose]: close };
};

/** Types used by {@link listen}. */
export namespace listen {
	export type EventMap = T.EventMap;
	export type EventMapType<Value> = T.EventMapType<Value>;
	export type Options = T.ConnectOptions;
	export type Server<Events extends T.EventMap = T.EventMap> = T.SharedEventSourceServer<Events>;
}
