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
const defaultMaximumBufferedAmount = 16 * 1024 * 1024;

type OpenConnection<Events extends EventMap, Context> = EventConnection<Events, Context> & {
	write(value: string): void;
};

/** Creates a Fetch handler that broadcasts typed JSON Server-Sent Events. */
export const createHandler = <const Events extends EventMap & EventMapDefinition<Events>, Context = undefined>(
	options: HandlerOptions<Events, Context> = {},
): EventSourceHandler<Events> => {
	const connections = new Set<OpenConnection<Events, Context>>();
	const headers = new Headers(options.headers);
	const maximumBufferedAmount = options.maximumBufferedAmount ?? defaultMaximumBufferedAmount;

	headers.set("Cache-Control", "no-cache, no-transform");
	headers.set("Content-Type", "text/event-stream");
	headers.set("X-Accel-Buffering", "no");

	if (!Number.isSafeInteger(maximumBufferedAmount) || maximumBufferedAmount < 1) {
		throw new RangeError("maximumBufferedAmount must be a positive safe integer");
	}

	let isClosed = false;

	const handle = async (request: Request): Promise<Response> => {
		if (isClosed) {
			return new Response("Service Unavailable", { status: 503 });
		}

		if (request.method !== "GET") {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
		}

		const signal = request.signal;

		signal.throwIfAborted();

		let context: Context | Response;

		try {
			context = options.authorize ? await options.authorize(request) : (undefined as Context);
		} catch (error) {
			signal.throwIfAborted();

			reportError(error);

			return error instanceof Response ? error : new Response("Internal Server Error", { status: 500 });
		}

		signal.throwIfAborted();

		if (context instanceof Response) {
			return context;
		}

		if (isClosed) {
			return new Response("Service Unavailable", { status: 503 });
		}

		const controller = new AbortController();

		let streamController: ReadableStreamDefaultController<Uint8Array>;
		let cleanup: (() => void) | undefined;
		let active = true;

		const write = (value: string): void => {
			if (!active) {
				return;
			}

			const payload = encoder.encode(value);

			if ((streamController.desiredSize ?? 0) < payload.byteLength) {
				finish(
					Object.assign(new Error("The event stream queue exceeds the configured maximum"), {
						name: "BackpressureError",
					}),
				);

				return;
			}

			streamController.enqueue(payload);
		};

		const finish = (reason?: unknown): void => {
			if (!active) {
				return;
			}

			active = false;

			signal.removeEventListener("abort", close);

			connections.delete(connection);

			controller.abort(reason);

			try {
				cleanup?.();
			} catch (error) {
				reportError(error);
			}

			try {
				reason === undefined ? streamController.close() : streamController.error(reason);
			} catch {}
		};
		const close = (): void => finish();

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

		const body = new ReadableStream<Uint8Array>(
			{
				start(value) {
					streamController = value;
				},
				cancel: close,
			},
			{ highWaterMark: maximumBufferedAmount, size: (chunk) => chunk.byteLength },
		);

		connections.add(connection);

		signal.addEventListener("abort", close, { once: true });

		if (signal.aborted) {
			close();

			signal.throwIfAborted();
		}

		try {
			const connectedCleanup = await options.connect?.(connection);

			if (active) {
				cleanup = connectedCleanup;
			} else {
				connectedCleanup?.();
			}
		} catch (error) {
			reportError(error);

			close();

			return new Response("Internal Server Error", { status: 500 });
		}

		return new Response(body, {
			headers,
		});
	};

	const handler = handle as EventSourceHandler<Events>;
	const broadcast = (value: string): void => {
		for (const connection of connections) {
			connection.write(value);
		}
	};
	const close = (): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;
		for (const connection of connections) {
			connection.close();
		}
	};

	Object.defineProperties(handler, {
		size: {
			get: () => connections.size,
		},
		send: {
			value: (name: string, data: JSONValue, sendOptions?: SendOptions) =>
				broadcast(encodeEvent(name, data, sendOptions)),
		},
		comment: {
			value: (value?: string) => broadcast(encodeComment(value)),
		},
		retry: {
			value: (milliseconds: number) => broadcast(encodeRetry(milliseconds)),
		},
		close: { value: close },
		[Symbol.dispose]: { value: close },
	});

	return handler;
};

/** Types used by {@link createHandler}. */
export namespace createHandler {
	/** Represents one open Server-Sent Events response. */
	export type Connection<Events extends T.EventMap = T.EventMap, Context = undefined> = T.EventConnection<
		Events,
		Context
	>;

	/** Represents a compile-time map from Server-Sent Event names to JSON values. */
	export type EventMap = T.EventMap;

	/** Represents the extracted event map retained by an EventSource handler or connection. */
	export type EventMapType<Value> = T.EventMapType<Value>;

	/** Represents a fetch handler that broadcasts typed JSON events to its open connections. */
	export type Handler<Events extends T.EventMap = T.EventMap> = T.EventSourceHandler<Events>;

	/** Represents a value represented without loss by JSON. */
	export type JSONValue = T.JSONValue;

	/** Represents the configuration for a Fetch-compatible Server-Sent Events handler. */
	export type Options<Events extends T.EventMap = T.EventMap, Context = undefined> = T.HandlerOptions<
		Events,
		Context
	>;

	/** Represents the optional spec fields attached to one Server-Sent Event. */
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

/** Returns a comment message for the given value, or throws if the value contains line breaks. */
const encodeComment = (value = ""): string => {
	validateField("Comment", value, false);

	return `: ${value}\n\n`;
};

/** Returns a `retry` message for the given delay in milliseconds, or throws if the delay is invalid. */
const encodeRetry = (milliseconds: number): string => {
	if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
		throw new RangeError("Retry delay must be a non-negative safe integer");
	}

	return `retry: ${milliseconds}\n\n`;
};

/** Throws if the value contains line breaks or null bytes. */
const validateField = (label: string, value: string, forbidNull: boolean): void => {
	if (value.includes("\r") || value.includes("\n") || (forbidNull && value.includes("\0"))) {
		throw new TypeError(`${label} cannot contain ${forbidNull ? "null or " : ""}line breaks`);
	}
};
