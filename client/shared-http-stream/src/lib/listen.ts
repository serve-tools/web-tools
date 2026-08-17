import { connect as connectHTTPStream } from "@serve-tools/client-http-stream";
import { listen as listenForMessages } from "@serve-tools/client-messaging/scope/worker";
import type * as T from "./.types.js";
import type {
	ConnectOptions,
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SharedHTTPStreamBridgeProtocol,
	SharedHTTPStreamServer,
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

/** Serves one worker-owned HTTP stream client to every connected page. */
export const listen = <const P extends Protocol & ProtocolDefinition<P>>(
	url: string | URL,
	options: ConnectOptions = {},
): SharedHTTPStreamServer<P> => {
	const controller = new AbortController();
	const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
	const httpStream = connectHTTPStream<P>(url, { ...options, signal });
	const connections = listenForMessages<SharedHTTPStreamBridgeProtocol>({
		requests: {
			request: ({ name, input }, { signal: operationSignal }) =>
				(httpStream as unknown as UntypedClient).request(name, input, { signal: operationSignal }),
		},
		subscriptions: {
			subscribe: ({ name, input }, { emit, complete, error, signal: operationSignal }) => {
				if (operationSignal.aborted) {
					return;
				}

				const subscription = (httpStream as unknown as UntypedClient).subscribe(name, input, emit, {
					signal: operationSignal,
					onComplete: complete,
					onError: error,
				});

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
		httpStream.close(reason);
		closed.resolve();
	};

	void httpStream.closed.then(close);

	return { httpStream, closed: closed.promise, close, [Symbol.dispose]: close };
};

export namespace listen {
	export type Options = T.ConnectOptions;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type Server<P extends T.Protocol = T.Protocol> = T.SharedHTTPStreamServer<P>;
}
