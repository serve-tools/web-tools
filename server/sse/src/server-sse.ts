import type { Protocol, ProtocolDefinition, ServerMessage } from "@serve-tools/realtime-protocol";
import { deserialize, isClientMessage } from "@serve-tools/realtime-protocol";
import {
	binaryContentType,
	encodeBase64,
	encodeServerSentEvent,
	eventStreamContentType,
	isNegotiatedMediaType,
} from "@serve-tools/realtime-protocol/sse";
import { createConnection } from "@serve-tools/server-realtime";
import type * as T from "./lib/types.js";
import type { Connection, FetchHandler, HandlerOptions, Handlers } from "./lib/types.js";

const keepAlive = new TextEncoder().encode(": keepalive\n\n");

/** Creates a Fetch handler for finite requests and streaming server-sent subscriptions. */
export function createHandler<const P extends Protocol & ProtocolDefinition<P>, Context = undefined>(
	handlers: Handlers<P, Context>,
	options: HandlerOptions<Context> = {},
): FetchHandler {
	const connections = new Set<Connection<P, Context>>();
	let isClosed = false;

	const handle = async (request: Request): Promise<Response> => {
		if (isClosed) {
			return new Response("Service Unavailable", { status: 503 });
		}
		if (request.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
		}
		if (!isNegotiatedMediaType(request.headers.get("content-type"), "application/octet-stream")) {
			return new Response("Unsupported Media Type", { status: 415 });
		}

		const acceptsEvents = isNegotiatedMediaType(request.headers.get("accept"), "text/event-stream");
		const acceptsBinary = isNegotiatedMediaType(request.headers.get("accept"), "application/octet-stream");

		if (!acceptsEvents && !acceptsBinary) {
			return new Response("Not Acceptable", { status: 406 });
		}

		let context: Context | Response;

		try {
			context = options.authorize ? await options.authorize(request) : (undefined as Context);
		} catch (error) {
			options.reportError?.(error);

			return error instanceof Response ? error : new Response("Internal Server Error", { status: 500 });
		}

		if (context instanceof Response) {
			return context;
		}
		if (isClosed) {
			return new Response("Service Unavailable", { status: 503 });
		}

		let payload: ArrayBuffer;
		let message: unknown;

		try {
			payload = await request.arrayBuffer();
			message = deserialize(payload);
		} catch {
			return new Response("Bad Request", { status: 400 });
		}

		if (!isClientMessage(message) || (message[1] !== "request" && message[1] !== "subscribe")) {
			return new Response("Bad Request", { status: 400 });
		}

		if ((message[1] === "subscribe") !== acceptsEvents) {
			return new Response("Not Acceptable", { status: 406 });
		}

		return message[1] === "request"
			? serveRequest<P, Context>(handlers, context, options, payload, request.signal, connections)
			: serveSubscription<P, Context>(handlers, context, options, payload, request.signal, connections);
	};
	const handler = handle as FetchHandler;
	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}
		isClosed = true;
		for (const connection of connections) {
			connection.close(reason);
		}
		connections.clear();
	};

	handler.close = close;
	handler[Symbol.dispose] = close;

	return handler;
}

export namespace createHandler {
	export type Handler = T.FetchHandler;
	export type Handlers<P extends T.Protocol, Context = undefined> = T.Handlers<P, Context>;
	export type Options<Context = undefined> = T.HandlerOptions<Context>;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
}

export type * from "./lib/types.js";

const serveRequest = async <P extends Protocol & ProtocolDefinition<P>, Context>(
	handlers: Handlers<P, Context>,
	context: Context,
	options: HandlerOptions<Context>,
	payload: ArrayBuffer,
	signal: AbortSignal,
	connections: Set<Connection<P, Context>>,
): Promise<Response> => {
	const delivered = Promise.withResolvers<ArrayBuffer>();
	let connection!: Connection<P, Context>;

	connection = createConnection<P, Context>(
		handlers,
		{
			send: delivered.resolve,
			close: () => delivered.resolve(new ArrayBuffer(0)),
		},
		context,
		options,
	);
	connections.add(connection);
	const abort = (): void => connection.disconnect(signal.reason);

	signal.addEventListener("abort", abort, { once: true });
	connection.receive(payload);

	try {
		const response = await delivered.promise;

		return new Response(response, { headers: { "Content-Type": binaryContentType } });
	} finally {
		signal.removeEventListener("abort", abort);
		connection.disconnect();
		connections.delete(connection);
	}
};

const serveSubscription = <P extends Protocol & ProtocolDefinition<P>, Context>(
	handlers: Handlers<P, Context>,
	context: Context,
	options: HandlerOptions<Context>,
	payload: ArrayBuffer,
	signal: AbortSignal,
	connections: Set<Connection<P, Context>>,
): Response => {
	let connection!: Connection<P, Context>;
	let finished = false;
	let stopKeepAlive = (): void => {};
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			const finish = (): void => {
				if (finished) {
					return;
				}
				finished = true;
				stopKeepAlive();
				try {
					controller.close();
				} catch {}
			};
			const interval = options.keepAliveInterval ?? 60_000;

			if (interval !== false) {
				const timer = setInterval(() => controller.enqueue(keepAlive), interval);
				stopKeepAlive = () => clearInterval(timer);
			}

			connection = createConnection<P, Context>(
				handlers,
				{
					send(message) {
						controller.enqueue(encodeServerSentEvent(encodeBase64(message)));

						const decoded = deserialize(message) as ServerMessage;
						if (decoded[1] === "complete" || decoded[1] === "reject" || decoded[1] === "close") {
							finish();
						}
					},
					close: finish,
				},
				context,
				options,
			);
			connections.add(connection);
			void connection.closed.then(() => {
				connections.delete(connection);
				finish();
			});
			signal.addEventListener("abort", () => connection.disconnect(signal.reason), { once: true });
			connection.receive(payload);
		},
		cancel(reason) {
			stopKeepAlive();
			connection?.disconnect(reason);
		},
	});

	return new Response(body, {
		headers: {
			"Cache-Control": "no-cache, no-transform",
			"Content-Type": eventStreamContentType,
			Vary: "Accept-Encoding",
			"X-Accel-Buffering": "no",
		},
	});
};
