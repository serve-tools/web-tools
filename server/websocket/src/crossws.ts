import { reportError } from "@serve-tools/polyfill-report-error";
import type { Protocol, ProtocolDefinition } from "@serve-tools/realtime-protocol";
import { offersWebSocketSubprotocol, subprotocol } from "@serve-tools/realtime-protocol";
import { createConnection } from "@serve-tools/server-realtime";
import type { Hooks, Message, Peer } from "crossws";
import type * as T from "./lib/types.js";
import type { Awaitable, Connection, ConnectionOptions, Handlers } from "./lib/types.js";

const contextKey = "@serve-tools/server-websocket";

/** Crossws upgrade authorization and connection options. */
export interface CrosswsOptions<Context = undefined> extends ConnectionOptions {
	/** Accepts the HTTP upgrade and returns its handler context, or returns an HTTP rejection response. */
	readonly authorize?: (request: Request) => Awaitable<Context | Response>;
}

/** Crossws lifecycle hooks with explicit shutdown for their active protocol connections. */
export interface CrosswsHooks extends Partial<Hooks>, Disposable {
	/** Closes every active protocol connection. */
	closeConnections(reason?: unknown): void;
}

/** Creates hooks for a crossws adapter, Nitro, Nuxt, or h3 WebSocket endpoint. */
export function createHooks<const P extends Protocol & ProtocolDefinition<P>, Context = undefined>(
	handlers: Handlers<P, Context>,
	options: CrosswsOptions<Context> = {},
): CrosswsHooks {
	const connections = new Map<Peer, Connection<P, Context>>();

	let isClosed = false;

	const hooks: CrosswsHooks = {
		async upgrade(request) {
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

			if (isClosed) {
				return new Response("Service Unavailable", { status: 503 });
			}

			return result instanceof Response
				? result
				: { protocol: subprotocol, context: { ...request.context, [contextKey]: result } };
		},
		open(peer): void {
			if (isClosed) {
				peer.close(1001, "Server closing");

				return;
			}

			const context = peer.context[contextKey] as Context;
			const connection = createConnection(
				handlers,
				{
					send: (payload) => peer.send(payload),
					bufferedAmount: () => peer.bufferedAmount,
					close: (code, reason) => peer.close(code, reason),
				},
				context,
				options,
			);

			connections.set(peer, connection);
			void connection.closed.then(() => connections.delete(peer));
		},
		message(peer, message): void {
			receiveCrosswsMessage(connections.get(peer), message);
		},
		close(peer, details): void {
			connections.get(peer)?.disconnect(details.reason || `WebSocket closed with code ${details.code ?? 1005}`);
		},
		error(peer, error): void {
			connections.get(peer)?.disconnect(error);
			peer.close(1011, "Transport failure");
		},
		closeConnections(reason?: unknown): void {
			if (isClosed) {
				return;
			}

			isClosed = true;

			for (const connection of connections.values()) {
				connection.close(reason);
			}
		},
		[Symbol.dispose](): void {
			this.closeConnections();
		},
	};

	return hooks;
}

/** Types used by {@link createHooks}. */
export namespace createHooks {
	export type Handlers<P extends T.Protocol, Context = undefined> = T.Handlers<P, Context>;
	export type Hooks = CrosswsHooks;
	export type Options<Context = undefined> = CrosswsOptions<Context>;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type RequestContext<Context = undefined> = T.RequestContext<Context>;
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
} from "./lib/types.js";

const receiveCrosswsMessage = (
	connection:
		| {
				receive(payload: ArrayBuffer | ArrayBufferView): void;
				fail(reason?: unknown): void;
		  }
		| undefined,
	message: Message,
): void => {
	if (!connection) {
		return;
	}

	if (typeof message.rawData === "string") {
		connection.fail("Expected a binary WebSocket message");

		return;
	}

	connection.receive(message.uint8Array());
};
