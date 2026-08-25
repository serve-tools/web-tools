import { reportError } from "@serve-tools/polyfill-report-error/reportError";
import type { Protocol, ProtocolDefinition } from "@serve-tools/realtime-protocol";
import { offersWebSocketSubprotocol, subprotocol } from "@serve-tools/realtime-protocol";
import { createConnection } from "@serve-tools/server-realtime";
import type * as T from "../lib/types.js";
import type { Awaitable, Connection, ConnectionOptions, Handlers } from "../lib/types.js";

interface SocketData<P extends Protocol, Context> {
	readonly context: Context;
	connection?: Connection<P, Context>;
}

/** The Bun server methods required to accept a WebSocket. */
export interface BunServerLike<Data> {
	/** Attempts to upgrade a request and associates data with the accepted WebSocket. */
	upgrade(request: Request, options: { readonly data: Data; readonly headers?: HeadersInit }): boolean;
}

/** The Bun server WebSocket methods required by the adapter. */
export interface BunWebSocketLike<Data> {
	/** Returns the data associated with this accepted WebSocket. */
	readonly data: Data;

	/** Sends one complete binary protocol message. */
	send(data: ArrayBuffer): number | undefined;

	/** Returns the number of queued outbound bytes. */
	getBufferedAmount(): number;

	/** Closes the WebSocket with an optional close code and reason. */
	close(code?: number, reason?: string): void;
}

/** Callback object accepted by `Bun.serve({ websocket })`. */
export interface BunWebSocketHandler<Data> {
	/** Declares the data shape supplied to WebSocket callbacks. */
	readonly data: Data;

	/** Requests ArrayBuffer delivery for binary messages. */
	readonly binaryType: "arraybuffer";

	/** Opens the protocol connection for an accepted WebSocket. */
	open(socket: BunWebSocketLike<Data>): void;

	/** Forwards an incoming WebSocket message. */
	message(socket: BunWebSocketLike<Data>, message: string | ArrayBuffer | Uint8Array): void;

	/** Disconnects the protocol connection after WebSocket closure. */
	close(socket: BunWebSocketLike<Data>, code: number, reason: string): void;

	/** Fails the protocol connection after a WebSocket error. */
	error(socket: BunWebSocketLike<Data>, error: Error): void;
}

/** Bun upgrade authorization and connection options. */
export interface BunAdapterOptions<Context = undefined> extends ConnectionOptions {
	/** Accepts the HTTP upgrade and returns its handler context, or returns an HTTP rejection response. */
	readonly authorize?: (request: Request) => Awaitable<Context | Response>;
}

/** A Bun upgrade helper and callback object owning every accepted protocol connection. */
export interface BunAdapter<P extends Protocol, Context> extends Disposable {
	/** Provides the callback object passed to `Bun.serve({ websocket })`. */
	readonly websocket: BunWebSocketHandler<SocketData<P, Context>>;

	/** Accepts a WebSocket upgrade or returns an HTTP response that rejects it. */
	upgrade(request: Request, server: BunServerLike<SocketData<P, Context>>): Promise<Response | undefined>;

	/** Closes active protocol connections and rejects later upgrades. */
	close(reason?: unknown): void;
}

/** Creates an adapter for `Bun.serve({ fetch, websocket })`. */
export function createBunAdapter<const P extends Protocol & ProtocolDefinition<P>, Context = undefined>(
	handlers: Handlers<P, Context>,
	options: BunAdapterOptions<Context> = {},
): BunAdapter<P, Context> {
	const connections = new Map<BunWebSocketLike<SocketData<P, Context>>, Connection<P, Context>>();

	let isClosed = false;

	const websocket: BunWebSocketHandler<SocketData<P, Context>> = {
		data: {} as SocketData<P, Context>,
		binaryType: "arraybuffer",
		open(socket): void {
			if (isClosed) {
				socket.close(1001, "Server closing");

				return;
			}

			const connection = createConnection(
				handlers,
				{
					send: (payload) => {
						if (socket.send(payload) === 0) {
							throw new Error("The Bun WebSocket dropped an outgoing message");
						}
					},
					bufferedAmount: () => socket.getBufferedAmount(),
					close: (code, reason) => socket.close(code, reason),
				},
				socket.data.context,
				options,
			);

			socket.data.connection = connection;
			connections.set(socket, connection);
		},
		message(socket, message): void {
			const connection = socket.data.connection;

			if (!connection) {
				socket.close(1011, "Connection unavailable");

				return;
			}

			if (typeof message === "string") {
				connection.fail("Expected a binary WebSocket message");
			} else {
				connection.receive(message);
			}
		},
		close(socket, code, reason): void {
			connections.delete(socket);
			socket.data.connection?.disconnect(reason || `WebSocket closed with code ${code}`);
		},
		error(socket, error): void {
			connections.delete(socket);
			socket.data.connection?.disconnect(error);
			socket.close(1011, "Transport failure");
		},
	};
	const upgrade = async (
		request: Request,
		server: BunServerLike<SocketData<P, Context>>,
	): Promise<Response | undefined> => {
		if (isClosed) {
			return new Response("Service Unavailable", { status: 503 });
		}

		if (!offersWebSocketSubprotocol(request.headers.get("sec-websocket-protocol"))) {
			return new Response("WebSocket Subprotocol Required", { status: 426 });
		}

		let result: Context | Response;

		try {
			result = options.authorize ? await options.authorize(request) : (undefined as Context);
		} catch (error) {
			reportError(error);

			return error instanceof Response ? error : new Response("Internal Server Error", { status: 500 });
		}

		if (result instanceof Response) {
			return result;
		}

		if (isClosed) {
			return new Response("Service Unavailable", { status: 503 });
		}

		return server.upgrade(request, {
			data: { context: result },
			headers: { "Sec-WebSocket-Protocol": subprotocol },
		})
			? undefined
			: new Response("WebSocket Upgrade Failed", { status: 400 });
	};
	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		for (const [socket, connection] of connections) {
			connection.close(reason);
			socket.close(1001, "Server closing");
		}

		connections.clear();
	};

	return { websocket, upgrade, close, [Symbol.dispose]: close };
}

/** Types used by {@link createBunAdapter}. */
export namespace createBunAdapter {
	/** The adapter returned by {@link createBunAdapter}. */
	export type Adapter<P extends T.Protocol, Context = undefined> = BunAdapter<P, Context>;

	/** Handler definitions accepted by {@link createBunAdapter}. */
	export type Handlers<P extends T.Protocol, Context = undefined> = T.Handlers<P, Context>;

	/** Adapter options accepted by {@link createBunAdapter}. */
	export type Options<Context = undefined> = BunAdapterOptions<Context>;

	/** The protocol shape accepted by {@link createBunAdapter}. */
	export type Protocol = T.Protocol;

	/** Extracts the declared value type for a protocol member. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** Context supplied to request handlers. */
	export type RequestContext<Context = undefined> = T.RequestContext<Context>;

	/** Context supplied to subscription handlers. */
	export type SubscriptionContext<Value, Context = undefined> = T.SubscriptionContext<Value, Context>;
}

export type {
	Connection,
	ConnectionOptions,
	Handlers,
	Protocol,
	ProtocolType,
	RequestContext,
	SubscriptionContext,
} from "../lib/types.js";
