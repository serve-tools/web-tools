/// <reference lib="esnext.disposable" />

import { RemoteError } from "@serve-tools/client-realtime";
import { deserialize, isServerMessage, protocol, serialize } from "@serve-tools/realtime-protocol";
import { contentType, isNegotiatedContentType } from "@serve-tools/realtime-protocol/http-stream";
import { FrameDecoder } from "@serve-tools/realtime-protocol/stream";
import type * as T from "./lib/types.js";
import type {
	Client,
	ConnectOptions,
	HeaderProvider,
	OperationRequest,
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SubscribeOptions,
	Subscription,
} from "./lib/types.js";

const noop = (): void => {};
const inactiveSubscription: Subscription = Object.freeze({ active: false, unsubscribe: noop, [Symbol.dispose]: noop });

/** Creates a typed HTTP client whose subscriptions consume framed binary response streams. */
export function connect<const P extends Protocol & ProtocolDefinition<P>>(
	url: string | URL,
	options: ConnectOptions = {},
): Client<P> {
	const fetcher = options.fetch ?? globalThis.fetch;
	const { fetch: _fetch, headers: _headers, signal: _signal, ...requestInit } = options;
	const closed = Promise.withResolvers<void>();
	const active = new Set<AbortController>();
	let nextId = 0;
	let isClosed = false;

	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		for (const controller of active) {
			controller.abort(reason);
		}

		active.clear();

		options.signal?.removeEventListener("abort", lifetimeAbort);

		closed.resolve();
	};
	const lifetimeAbort = (): void => close(options.signal?.reason);

	options.signal?.addEventListener("abort", lifetimeAbort, { once: true });

	if (options.signal?.aborted) {
		close(options.signal.reason);
	}

	const begin = (signal?: AbortSignal): AbortController => {
		if (isClosed) {
			throw connectionClosedError();
		}

		const controller = new AbortController();
		const abort = (): void => controller.abort(signal?.reason);

		if (signal?.aborted) {
			controller.abort(signal.reason);
		} else {
			signal?.addEventListener("abort", abort, { once: true, signal: controller.signal });
		}

		active.add(controller);

		return controller;
	};
	const headers = async (operation: OperationRequest): Promise<Headers> => {
		const supplied =
			typeof options.headers === "function"
				? await (options.headers as HeaderProvider)(operation)
				: options.headers;
		const result = new Headers(supplied);

		result.set("Accept", contentType);
		result.set("Content-Type", contentType);

		return result;
	};
	const post = async (
		operation: OperationRequest,
		message: import("@serve-tools/realtime-protocol").ClientMessage,
		controller: AbortController,
	): Promise<Response> => {
		return fetcher(url, {
			...requestInit,
			headers: await headers(operation),
			method: "POST",
			body: serialize(message),
			signal: controller.signal,
		});
	};
	const nextOperationId = (): number => {
		if (nextId >= Number.MAX_SAFE_INTEGER) {
			throw new RangeError("The client exhausted its operation IDs");
		}

		return ++nextId;
	};

	return {
		async request(name: string, input?: unknown, requestOptions: RequestOptions = {}): Promise<unknown> {
			const id = nextOperationId();
			const controller = begin(requestOptions.signal);

			try {
				const response = await post(
					{ kind: "request", name },
					[protocol, "request", id, name, input],
					controller,
				);

				validateResponse(response);

				const message = deserialize(await response.arrayBuffer());

				if (
					!isServerMessage(message) ||
					message[1] === "event" ||
					message[1] === "complete" ||
					(message[1] !== "close" && message[2] !== id)
				) {
					throw protocolError();
				}

				if (message[1] === "reject") {
					throw remoteError(message[3]);
				}
				if (message[1] === "close") {
					throw remoteError(message[2]);
				}

				return message[3];
			} finally {
				controller.abort();
				active.delete(controller);
			}
		},
		subscribe(
			name: string,
			inputOrListener: unknown,
			listenerOrOptions?: ((value: unknown) => void) | SubscribeOptions,
			maybeOptions?: SubscribeOptions,
		): Subscription {
			if (isClosed) {
				throw connectionClosedError();
			}

			const noInput = typeof inputOrListener === "function";
			const input = noInput ? undefined : inputOrListener;
			const listener = (noInput ? inputOrListener : listenerOrOptions) as (value: unknown) => void;
			const subscribeOptions = (noInput ? listenerOrOptions : maybeOptions) as SubscribeOptions | undefined;

			if (subscribeOptions?.signal?.aborted) {
				return inactiveSubscription;
			}

			const id = nextOperationId();
			const controller = begin(subscribeOptions?.signal);

			let isActive = true;

			const unsubscribe = (): void => {
				if (!isActive) {
					return;
				}

				isActive = false;

				controller.abort();
				active.delete(controller);
			};

			void (async () => {
				try {
					const response = await post(
						{ kind: "subscription", name },
						[protocol, "subscribe", id, name, input],
						controller,
					);

					validateResponse(response);

					if (!response.body) {
						throw new TypeError("The binary stream response has no body");
					}

					const decoder = new FrameDecoder();
					const reader = response.body.getReader();

					try {
						while (isActive) {
							const result = await reader.read();

							if (result.done) {
								break;
							}

							for (const payload of decoder.push(result.value)) {
								const message = deserialize(payload);

								if (
									!isServerMessage(message) ||
									message[1] === "resolve" ||
									(message[1] !== "close" && message[2] !== id)
								) {
									throw protocolError();
								}

								if (message[1] === "event") {
									callSafely(listener, message[3]);
								} else if (message[1] === "complete") {
									isActive = false;
									if (subscribeOptions?.onComplete) {
										callSafely(subscribeOptions.onComplete, undefined);
									}
								} else if (message[1] === "reject") {
									throw remoteError(message[3]);
								} else {
									throw remoteError(message[2]);
								}
							}
						}

						decoder.finish();

						if (isActive) {
							throw protocolError("The binary stream ended before completion");
						}
					} finally {
						reader.releaseLock();
					}
				} catch (error) {
					if (!controller.signal.aborted) {
						if (subscribeOptions?.onError) {
							callSafely(subscribeOptions.onError, asError(error));
						} else {
							reportError(error);
						}
					}
				} finally {
					isActive = false;

					controller.abort();
					active.delete(controller);
				}
			})();

			return {
				get active() {
					return isActive;
				},
				unsubscribe,
				[Symbol.dispose]: unsubscribe,
			};
		},
		closed: closed.promise,
		close,
		[Symbol.dispose]: close,
	} as Client<P>;
}

export namespace connect {
	export type Client<P extends T.Protocol = T.Protocol> = T.Client<P>;
	export type Options = T.ConnectOptions;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type RequestOptions = T.RequestOptions;
	export type SubscribeOptions = T.SubscribeOptions;
	export type Subscription = T.Subscription;
}

export { RemoteError } from "@serve-tools/client-realtime";
export type * from "./lib/types.js";

const validateResponse = (response: Response): void => {
	if (!response.ok) {
		throw Object.assign(new Error(`HTTP ${response.status} ${response.statusText}`), {
			name: "HTTPError",
			status: response.status,
		});
	}

	if (!isNegotiatedContentType(response.headers.get("content-type"))) {
		throw protocolError("The response did not select the Serve Tools protocol");
	}
};

const remoteError = (record: import("@serve-tools/realtime-protocol").ErrorRecord): RemoteError =>
	new RemoteError(record.name, record.message, record.stack);
const protocolError = (reason = "Invalid protocol response"): Error =>
	Object.assign(new Error(reason), { name: "ProtocolError" });
const callSafely = <Value>(callback: (value: Value) => void, value: Value): void => {
	try {
		callback(value);
	} catch (error) {
		reportError(error);
	}
};
const connectionClosedError = (): Error =>
	Object.assign(new Error("The client is closed"), { name: "ConnectionClosedError" });
const asError = (reason: unknown): Error => (reason instanceof Error ? reason : new Error(String(reason)));
