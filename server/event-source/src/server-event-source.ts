/// <reference lib="esnext.disposable" />

import { reportError } from "@serve-tools/polyfill-report-error";
import type * as T from "./lib/types.js";
import type {
	EventConnection,
	EventMap,
	EventMapDefinition,
	EventSourceHandler,
	HandlerOptions,
	JSONValue,
	SendOptions,
} from "./lib/types.js";

const encoder = new TextEncoder();

type OpenConnection<Events extends EventMap, Context> = EventConnection<Events, Context> & {
	write(value: string): void;
};

/** Creates a Fetch handler that broadcasts typed JSON Server-Sent Events. */
export const createHandler = <const Events extends EventMap & EventMapDefinition<Events>, Context = undefined>(
	options: HandlerOptions<Events, Context> = {},
): EventSourceHandler<Events> => {
	const connections = new Set<OpenConnection<Events, Context>>();
	let isClosed = false;

	const handle = async (request: Request): Promise<Response> => {
		if (isClosed) {
			return new Response("Service Unavailable", { status: 503 });
		}
		if (request.method !== "GET") {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
		}

		let context: Context | Response;

		try {
			context = options.authorize ? await options.authorize(request) : (undefined as Context);
		} catch (error) {
			reportError(error);

			return error instanceof Response ? error : new Response("Internal Server Error", { status: 500 });
		}

		if (context instanceof Response) {
			return context;
		}
		if (isClosed) {
			return new Response("Service Unavailable", { status: 503 });
		}

		const controller = new AbortController();
		let streamController: ReadableStreamDefaultController<Uint8Array>;
		let cleanup = (): void => {};
		let active = true;

		const write = (value: string): void => {
			if (active) {
				streamController.enqueue(encoder.encode(value));
			}
		};
		const close = (): void => {
			if (!active) {
				return;
			}

			active = false;
			request.signal.removeEventListener("abort", close);
			connections.delete(connection);
			controller.abort();

			try {
				cleanup();
			} catch (error) {
				reportError(error);
			}

			try {
				streamController.close();
			} catch {}
		};
		const connection: OpenConnection<Events, Context> = {
			context,
			request,
			signal: controller.signal,
			lastEventId: request.headers.get("last-event-id") ?? "",
			write,
			send: (name, data, sendOptions) => write(encodeEvent(String(name), data, sendOptions)),
			comment: (value) => write(encodeComment(value)),
			retry: (milliseconds) => write(encodeRetry(milliseconds)),
			close,
			[Symbol.dispose]: close,
		};
		const body = new ReadableStream<Uint8Array>({
			start(value) {
				streamController = value;
			},
			cancel: close,
		});

		connections.add(connection);
		request.signal.addEventListener("abort", close, { once: true });

		try {
			const connectedCleanup = await options.connect?.(connection);

			if (active) {
				cleanup = connectedCleanup ?? cleanup;
			} else {
				connectedCleanup?.();
			}
		} catch (error) {
			reportError(error);
			close();

			return new Response("Internal Server Error", { status: 500 });
		}

		return new Response(body, {
			headers: {
				"Cache-Control": "no-cache, no-transform",
				"Content-Type": "text/event-stream",
				"X-Accel-Buffering": "no",
			},
		});
	};
	const handler = handle as EventSourceHandler<Events>;

	Object.defineProperties(handler, {
		size: { get: () => connections.size },
		send: {
			value: (name: string, data: JSONValue, sendOptions?: SendOptions) => {
				const value = encodeEvent(name, data, sendOptions);

				for (const connection of connections) {
					connection.write(value);
				}
			},
		},
		comment: {
			value: (value?: string) => {
				const encoded = encodeComment(value);

				for (const connection of connections) {
					connection.write(encoded);
				}
			},
		},
		retry: {
			value: (milliseconds: number) => {
				const encoded = encodeRetry(milliseconds);

				for (const connection of connections) {
					connection.write(encoded);
				}
			},
		},
		close: {
			value: () => {
				if (isClosed) {
					return;
				}

				isClosed = true;
				for (const connection of [...connections]) {
					connection.close();
				}
			},
		},
		[Symbol.dispose]: { value: () => handler.close() },
	});

	return handler;
};

/** Types used by {@link createHandler}. */
export namespace createHandler {
	export type Connection<Events extends T.EventMap = T.EventMap, Context = undefined> = T.EventConnection<
		Events,
		Context
	>;
	export type EventMap = T.EventMap;
	export type EventMapType<Value> = T.EventMapType<Value>;
	export type Handler<Events extends T.EventMap = T.EventMap> = T.EventSourceHandler<Events>;
	export type JSONValue = T.JSONValue;
	export type Options<Events extends T.EventMap = T.EventMap, Context = undefined> = T.HandlerOptions<
		Events,
		Context
	>;
	export type SendOptions = T.SendOptions;
}

export type * from "./lib/types.js";

const encodeEvent = (name: string, data: JSONValue, options?: SendOptions): string => {
	validateField("Event name", name, false);

	const json = JSON.stringify(data);

	if (json === undefined) {
		throw new TypeError("Event data must be a JSON value");
	}

	let output = name === "message" ? "" : `event: ${name}\n`;

	if (options?.id !== undefined) {
		validateField("Event ID", options.id, true);
		output += `id: ${options.id}\n`;
	}

	return `${output}data: ${json}\n\n`;
};

const encodeComment = (value = ""): string => {
	validateField("Comment", value, false);

	return `: ${value}\n\n`;
};

const encodeRetry = (milliseconds: number): string => {
	if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
		throw new RangeError("Retry delay must be a non-negative safe integer");
	}

	return `retry: ${milliseconds}\n\n`;
};

const validateField = (label: string, value: string, forbidNull: boolean): void => {
	if (value.includes("\r") || value.includes("\n") || (forbidNull && value.includes("\0"))) {
		throw new TypeError(`${label} cannot contain ${forbidNull ? "null or " : ""}line breaks`);
	}
};
