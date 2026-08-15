import { listen as listenForMessages } from "@serve-tools/client-messaging/scope/worker";
import { connect as connectWebSocket } from "@serve-tools/client-websocket";
import type * as T from "./.types.js";
import type {
	ConnectOptions,
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SharedWebSocketBridgeProtocol,
	SharedWebSocketServer,
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
};

const noop = (): void => {};

/** Opens one physical WebSocket and serves its typed protocol to every port connected to this `SharedWorker`. */
export const listen = <const P extends Protocol & ProtocolDefinition<P>>(
	url: string | URL,
	options: ConnectOptions = {},
): SharedWebSocketServer<P> => {
	const controller = new AbortController();
	const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
	const websocket = connectWebSocket<P>(url, { ...options, signal });
	const closed = Promise.withResolvers<void>();

	void websocket.catch(noop);

	const connections = listenForMessages<SharedWebSocketBridgeProtocol>({
		requests: {
			request: async ({ name, input }, { signal: operationSignal }) =>
				((await websocket) as unknown as UntypedClient).request(name, input, { signal: operationSignal }),
		},
		subscriptions: {
			subscribe: async ({ name, input }, { emit, complete, error, signal: operationSignal }) => {
				const client = (await websocket) as unknown as UntypedClient;

				if (operationSignal.aborted) {
					return;
				}

				const subscription = client.subscribe(name, input, emit, {
					signal: operationSignal,
					onComplete: complete,
					onError: error,
				});

				return subscription.unsubscribe;
			},
		},
	});

	let isClosed = false;

	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		connections.close(reason);
		controller.abort(reason);

		void websocket.then((client) => client.close(reason), noop);

		closed.resolve();
	};

	void websocket.then((client) => void client.closed.then(close), close);

	return {
		websocket,
		closed: closed.promise,
		close,
		[Symbol.dispose]: close,
	};
};

/** Types used by {@link listen}. */
export namespace listen {
	/** Options for opening the physical WebSocket. */
	export type Options = T.ConnectOptions;

	/** Extracts the protocol retained by a shared WebSocket resource. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** A worker-owned physical WebSocket and its attached page connections. */
	export type Server<P extends T.Protocol = T.Protocol> = T.SharedWebSocketServer<P>;
}
