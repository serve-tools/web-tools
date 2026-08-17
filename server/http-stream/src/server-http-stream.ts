import type { Protocol, ProtocolDefinition, ServerMessage } from "@serve-tools/realtime-protocol";
import { deserialize, isClientMessage } from "@serve-tools/realtime-protocol";
import { contentType, isNegotiatedContentType } from "@serve-tools/realtime-protocol/http-stream";
import { encodeFrame } from "@serve-tools/realtime-protocol/stream";
import { createConnection } from "@serve-tools/server-realtime";
import type * as T from "./lib/types.js";
import type { Connection, FetchHandler, HandlerOptions, Handlers } from "./lib/types.js";

const defaultMaximumMessageLength = 16 * 1024 * 1024;
const messageTooLarge = Symbol("messageTooLarge");

/** Creates a Fetch handler for finite requests and framed binary subscriptions. */
export function createHandler<const P extends Protocol & ProtocolDefinition<P>, Context = undefined>(
	handlers: Handlers<P, Context>,
	options: HandlerOptions<Context> = {},
): FetchHandler {
	const connections = new Set<Connection<P, Context>>();
	const maximumMessageLength = options.maximumMessageLength ?? defaultMaximumMessageLength;

	if (!Number.isSafeInteger(maximumMessageLength) || maximumMessageLength < 1) {
		throw new RangeError("Connection limits must be positive safe integers");
	}

	let isClosed = false;

	const handle = async (request: Request): Promise<Response> => {
		if (isClosed) {
			return new Response("Service Unavailable", { status: 503 });
		}
		if (request.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
		}
		if (!isNegotiatedContentType(request.headers.get("content-type"))) {
			return new Response("Unsupported Media Type", { status: 415 });
		}
		if (!isNegotiatedContentType(request.headers.get("accept"))) {
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
			payload = await readBody(request, maximumMessageLength);
			message = deserialize(payload);
		} catch (error) {
			if (error === messageTooLarge) {
				return new Response("Content Too Large", { status: 413 });
			}

			return new Response("Bad Request", { status: 400 });
		}

		if (!isClientMessage(message) || (message[1] !== "request" && message[1] !== "subscribe")) {
			return new Response("Bad Request", { status: 400 });
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

	const abort = (): void => {
		delivered.reject(signal.reason);
		connection.disconnect(signal.reason);
	};

	if (signal.aborted) {
		abort();
	} else {
		signal.addEventListener("abort", abort, { once: true });
	}
	connection.receive(payload);

	try {
		const response = await delivered.promise;

		return new Response(response, { headers: { "Content-Type": contentType } });
	} finally {
		signal.removeEventListener("abort", abort);
		connection.disconnect();
		connections.delete(connection);
	}
};

const readBody = async (request: Request, maximumLength: number): Promise<ArrayBuffer> => {
	const contentLength = request.headers.get("content-length");

	if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maximumLength) {
		throw messageTooLarge;
	}

	if (!request.body) {
		const payload = await request.arrayBuffer();

		if (payload.byteLength > maximumLength) {
			throw messageTooLarge;
		}

		return payload;
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;

	try {
		while (true) {
			const result = await reader.read();

			if (result.done) {
				break;
			}

			length += result.value.byteLength;

			if (length > maximumLength) {
				await reader.cancel();

				throw messageTooLarge;
			}

			chunks.push(result.value);
		}
	} finally {
		reader.releaseLock();
	}

	const output = new Uint8Array(length);
	let offset = 0;

	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return output.buffer;
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
	let stopAbort = (): void => {};

	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			const finish = (): void => {
				if (finished) {
					return;
				}
				finished = true;
				stopAbort();
				try {
					controller.close();
				} catch {}
			};
			connection = createConnection<P, Context>(
				handlers,
				{
					send(message) {
						controller.enqueue(encodeFrame(message));

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

			const abort = (): void => connection.disconnect(signal.reason);

			if (signal.aborted) {
				abort();
			} else {
				signal.addEventListener("abort", abort, { once: true });
				stopAbort = () => signal.removeEventListener("abort", abort);
			}

			connection.receive(payload);
		},
		cancel(reason) {
			stopAbort();
			connection?.disconnect(reason);
		},
	});

	return new Response(body, {
		headers: {
			"Cache-Control": "no-cache, no-transform",
			"Content-Type": contentType,
			"X-Accel-Buffering": "no",
		},
	});
};
