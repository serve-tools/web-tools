import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Protocol, ProtocolDefinition } from "@serve-tools/realtime-protocol";
import { WebSocketServer } from "ws";
import { attach } from "../lib/attach.js";
import type * as T from "../lib/types.js";
import type { Awaitable, Connection, ConnectionOptions, Handlers } from "../lib/types.js";

const defaultMaximumMessageLength = 16 * 1024 * 1024;

/** Node upgrade authorization and connection options. */
export interface HandleUpgradeOptions<Context = undefined> extends ConnectionOptions {
	/** Accepts the HTTP upgrade and returns its handler context, or returns an HTTP rejection response. */
	readonly authorize?: (request: IncomingMessage) => Awaitable<Context | Response>;
}

/** A disposable `node:http` upgrade listener owning every accepted protocol connection. */
export interface UpgradeHandler extends Disposable {
	(request: IncomingMessage, socket: Duplex, head: Buffer): void;

	/** Closes every accepted protocol connection and rejects future upgrades. */
	close(reason?: unknown): void;
}

/** Creates a `node:http` upgrade listener backed by the optional `ws` peer dependency. */
export function handleUpgrade<const P extends Protocol & ProtocolDefinition<P>, Context = undefined>(
	handlers: Handlers<P, Context>,
	options: HandleUpgradeOptions<Context> = {},
): UpgradeHandler {
	const maximumMessageLength = options.maximumMessageLength ?? defaultMaximumMessageLength;

	if (!Number.isSafeInteger(maximumMessageLength) || maximumMessageLength < 1) {
		throw new RangeError("The maximum message length must be a positive safe integer");
	}

	const websocketServer = new WebSocketServer({
		noServer: true,
		maxPayload: maximumMessageLength,
		perMessageDeflate: false,
	});
	const connections = new Set<Connection<P, Context>>();

	let isClosed = false;

	const upgrade = async (request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> => {
		if (isClosed) {
			await rejectUpgrade(socket, new Response("Service Unavailable", { status: 503 }));

			return;
		}

		let result: Context | Response;

		try {
			result = options.authorize ? await options.authorize(request) : (undefined as Context);
		} catch (error) {
			result = error instanceof Response ? error : new Response("Internal Server Error", { status: 500 });

			options.reportError?.(error);
		}

		if (result instanceof Response) {
			await rejectUpgrade(socket, result);

			return;
		}

		websocketServer.handleUpgrade(request, socket, head, (websocket) => {
			const connection = attach(websocket as unknown as T.WebSocketLike, handlers, result, options);

			connections.add(connection);
			void connection.closed.then(() => connections.delete(connection));
		});
	};
	const listener = ((request, socket, head): void => {
		void upgrade(request, socket, head).catch((error) => {
			options.reportError?.(error);

			if (!socket.destroyed) {
				socket.destroy(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}) as UpgradeHandler;
	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		for (const connection of connections) {
			connection.close(reason);
		}
	};

	listener.close = close;
	listener[Symbol.dispose] = close;

	return listener;
}

/** Types used by {@link handleUpgrade}. */
export namespace handleUpgrade {
	export type Handler = UpgradeHandler;
	export type Handlers<P extends T.Protocol, Context = undefined> = T.Handlers<P, Context>;
	export type Options<Context = undefined> = HandleUpgradeOptions<Context>;
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
} from "../lib/types.js";

const rejectUpgrade = async (socket: Duplex, response: Response): Promise<void> => {
	const body = new Uint8Array(await response.arrayBuffer());
	const headers = new Headers(response.headers);

	headers.set("connection", "close");
	headers.set("content-length", String(body.byteLength));

	const statusText = response.statusText || defaultStatusText(response.status);
	const lines = [`HTTP/1.1 ${response.status} ${statusText}`];

	for (const [name, value] of headers) {
		lines.push(`${name}: ${value}`);
	}

	lines.push("", "");

	socket.end(Buffer.concat([Buffer.from(lines.join("\r\n")), body]));
};

const defaultStatusText = (status: number): string =>
	status === 401
		? "Unauthorized"
		: status === 403
			? "Forbidden"
			: status === 503
				? "Service Unavailable"
				: status >= 500
					? "Internal Server Error"
					: "Upgrade Rejected";
