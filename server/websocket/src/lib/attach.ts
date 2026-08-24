import type { Protocol, ProtocolDefinition } from "@serve-tools/realtime-protocol";
import { createConnection } from "@serve-tools/server-realtime";
import type * as T from "./types.js";
import type { Connection, ConnectionOptions, Handlers, WebSocketLike } from "./types.js";

/** Attaches one typed protocol server to an accepted WHATWG-compatible WebSocket. */
export function attach<const P extends Protocol & ProtocolDefinition<P>, Context = undefined>(
	socket: WebSocketLike,
	handlers: Handlers<P, Context>,
	context: Context,
	options: ConnectionOptions = {},
): Connection<P, Context> {
	socket.binaryType = "arraybuffer";

	const connection = createConnection(
		handlers,
		{
			send: (payload) => socket.send(payload),
			bufferedAmount: () => socket.bufferedAmount,
			close: (code, reason) => {
				if (socket.readyState < 2) {
					socket.close(code, reason);
				}
			},
		},
		context,
		options,
	);
	const receive = ({ data }: MessageEvent): void => {
		if (!(data instanceof ArrayBuffer)) {
			connection.fail("Expected a binary WebSocket message");

			return;
		}

		connection.receive(data);
	};
	const close = (event: CloseEvent): void => {
		connection.disconnect(event.reason || `WebSocket closed with code ${event.code}`);
	};
	const error = (): void => {
		connection.disconnect(Object.assign(new Error("The WebSocket transport failed"), { name: "WebSocketError" }));

		if (socket.readyState < 2) {
			socket.close(1011, "Transport failure");
		}
	};
	const cleanup = (): void => {
		socket.removeEventListener("message", receive);
		socket.removeEventListener("close", close);
		socket.removeEventListener("error", error);
	};

	socket.addEventListener("message", receive);
	socket.addEventListener("close", close, { once: true });
	socket.addEventListener("error", error, { once: true });

	void connection.closed.then(cleanup);

	return connection;
}

/** Types used by {@link attach}. */
export namespace attach {
	/** The connection returned by {@link attach}. */
	export type Connection<P extends T.Protocol = T.Protocol, Context = undefined> = T.Connection<P, Context>;

	/** Handler definitions accepted by {@link attach}. */
	export type Handlers<P extends T.Protocol, Context = undefined> = T.Handlers<P, Context>;

	/** Connection options accepted by {@link attach}. */
	export type Options = T.ConnectionOptions;

	/** The protocol shape accepted by {@link attach}. */
	export type Protocol = T.Protocol;

	/** Extracts the declared value type for a protocol member. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** Context supplied to request handlers. */
	export type RequestContext<Context = undefined> = T.RequestContext<Context>;

	/** Context supplied to subscription handlers. */
	export type SubscriptionContext<Value, Context = undefined> = T.SubscriptionContext<Value, Context>;

	/** The accepted WHATWG-compatible WebSocket shape. */
	export type WebSocket = T.WebSocketLike;
}
