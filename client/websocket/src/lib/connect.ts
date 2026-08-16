/// <reference lib="esnext.disposable" />

import { deserialize, isServerMessage, protocol, serialize } from "@serve-tools/realtime-protocol";
import { callSafely, connectionClosedError, errorRecord, noop, protocolError, remoteError } from "./.internals.js";
import type * as T from "./.types.js";
import type {
	Client,
	ClientMessage,
	ClientOperation,
	ConnectOptions,
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SubscribeOptions,
	Subscription,
} from "./.types.js";

const inactiveSubscription: Subscription = Object.freeze({
	active: false,
	unsubscribe: noop,
	[Symbol.dispose]: noop,
});

/** Opens a typed request and subscription client over one WebSocket connection. */
export async function connect<const P extends Protocol & ProtocolDefinition<P>>(
	url: string | URL,
	options: ConnectOptions = {},
): Promise<Client<P>> {
	const socket = new WebSocket(url, options?.protocols ?? []);

	socket.binaryType = "arraybuffer";

	await opened(socket, options.signal);

	const operations = new Map<number, ClientOperation>();
	const closed = Promise.withResolvers<void>();

	let nextId = 0;
	let isClosed = false;

	const send = (message: ClientMessage): void => {
		if (socket.readyState !== WebSocket.OPEN) {
			throw connectionClosedError();
		}

		socket.send(serialize(message));
	};

	const finish = (error: unknown, remote: boolean): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		socket.removeEventListener("message", receive);
		socket.removeEventListener("close", disconnected);

		for (const [id, operation] of operations) {
			operations.delete(id);
			operation.off();

			if (operation.kind === "request" || remote) {
				operation.settle(false, error);
			} else {
				operation.cancel(error);
			}
		}

		closed.resolve();
	};

	const closeSocket = (): void => {
		if (socket.readyState >= WebSocket.CLOSING) {
			return;
		}

		try {
			socket.close(1000);
		} catch {}
	};

	const fail = (error: Error): void => {
		try {
			send([protocol, "close", errorRecord(error)]);
		} catch {}

		finish(error, true);
		closeSocket();
	};

	function receive({ data }: MessageEvent): void {
		if (isClosed) {
			return;
		}

		let message: unknown;

		try {
			if (!(data instanceof ArrayBuffer)) {
				throw protocolError("Expected a binary WebSocket message");
			}

			message = deserialize(data);
		} catch (error) {
			fail(protocolError(error));

			return;
		}

		if (!isServerMessage(message)) {
			fail(protocolError());

			return;
		}

		if (message[1] === "close") {
			finish(remoteError(message[2]), true);
			closeSocket();

			return;
		}

		const id = message[2];
		const operation = operations.get(id);

		if (!operation) {
			return;
		}

		if (message[1] === "event") {
			if (operation.kind !== "subscription") {
				fail(protocolError("A request received a subscription event"));

				return;
			}

			callSafely(operation.next, message[3]);

			return;
		}

		if (
			(message[1] === "resolve" && operation.kind !== "request") ||
			(message[1] === "complete" && operation.kind !== "subscription")
		) {
			fail(protocolError("The operation received an incompatible settlement"));

			return;
		}

		operations.delete(id);
		operation.off();
		operation.settle(
			message[1] !== "reject",
			message[1] === "reject" ? remoteError(message[3]) : message[1] === "resolve" ? message[3] : undefined,
		);
	}

	function disconnected(event: CloseEvent): void {
		const detail = event.reason || (event.code === 1000 ? undefined : `WebSocket closed with code ${event.code}`);

		finish(connectionClosedError(detail), true);
	}

	const cancel = (id: number): boolean => {
		const operation = operations.get(id);

		if (!operation) {
			return false;
		}

		operations.delete(id);
		operation.off();

		try {
			send([protocol, "cancel", id]);
		} catch {}

		return true;
	};

	const open = (
		kind: "request" | "subscription",
		name: string,
		input: unknown,
		options: RequestOptions,
		next: (value: unknown) => void,
		settle: (ok: boolean, value: unknown) => void,
		onAbort: (reason: unknown) => void,
	): number => {
		if (nextId >= Number.MAX_SAFE_INTEGER) {
			throw new RangeError("The connection exhausted its operation IDs");
		}

		const id = ++nextId;
		const signal = options.signal;
		const abort = signal
			? (): void => {
					if (cancel(id)) {
						onAbort(signal.reason);
					}
				}
			: noop;
		const off = signal ? (): void => signal.removeEventListener("abort", abort) : noop;

		signal?.addEventListener("abort", abort, { once: true });
		operations.set(id, { kind, next, settle, cancel: onAbort, off });

		try {
			send([protocol, kind === "request" ? "request" : "subscribe", id, name, input]);
		} catch (error) {
			operations.delete(id);
			off();
			throw error;
		}

		return id;
	};

	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}

		const error = connectionClosedError(reason);

		try {
			send([protocol, "close", errorRecord(error)]);
		} catch {}

		finish(error, false);
		closeSocket();
	};

	socket.addEventListener("message", receive);
	socket.addEventListener("close", disconnected, { once: true });

	return {
		request(name: string, input?: unknown, requestOptions: RequestOptions = {}): Promise<unknown> {
			if (isClosed) {
				return Promise.reject(connectionClosedError());
			}

			if (requestOptions.signal?.aborted) {
				return Promise.reject(requestOptions.signal.reason);
			}

			return new Promise((resolve, reject) => {
				open(
					"request",
					name,
					input,
					requestOptions,
					noop,
					(ok, value) => (ok ? resolve(value) : reject(value)),
					reject,
				);
			});
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

			let active = !subscribeOptions?.signal?.aborted;

			if (!active) {
				return inactiveSubscription;
			}

			const id = open(
				"subscription",
				name,
				input,
				Object(subscribeOptions),
				listener,
				(ok, value) => {
					active = false;

					if (ok) {
						callSafely(() => subscribeOptions?.onComplete?.(), undefined);
					} else if (subscribeOptions?.onError) {
						callSafely(
							subscribeOptions.onError,
							value instanceof Error ? value : remoteError(errorRecord(value)),
						);
					} else {
						reportError(value);
					}
				},
				() => {
					active = false;
				},
			);
			const unsubscribe = (): void => {
				if (cancel(id)) {
					active = false;
				}
			};

			return {
				get active(): boolean {
					return active;
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

/** Types used by {@link connect}. */
export namespace connect {
	/** A typed, disposable WebSocket protocol client. */
	export type Client<P extends T.Protocol = T.Protocol> = T.Client<P>;

	/** Options for opening a WebSocket protocol client. */
	export type Options = T.ConnectOptions;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** Extracts the inline protocol retained by a resolved or pending client. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** Options for sending and cancelling a request. */
	export type RequestOptions = T.RequestOptions;

	/** Options for sending, cancelling, and observing the completion of a subscription. */
	export type SubscribeOptions = T.SubscribeOptions;

	/** A disposable handle for one active subscription. */
	export type Subscription = T.Subscription;
}

const opened = (socket: WebSocket, signal?: AbortSignal): Promise<void> => {
	if (signal?.aborted) {
		socket.close();

		return Promise.reject(signal.reason);
	}

	return new Promise((resolve, reject) => {
		const cleanup = (): void => {
			socket.removeEventListener("open", open);
			socket.removeEventListener("error", error);
			socket.removeEventListener("close", close);
			signal?.removeEventListener("abort", abort);
		};
		const open = (): void => {
			cleanup();
			resolve();
		};
		const error = (): void => {
			cleanup();
			reject(Object.assign(new Error("The WebSocket connection failed"), { name: "WebSocketError" }));
		};
		const close = (event: CloseEvent): void => {
			cleanup();
			reject(connectionClosedError(event.reason || `WebSocket closed with code ${event.code}`));
		};
		const abort = (): void => {
			cleanup();
			socket.close();
			reject(signal?.reason);
		};

		socket.addEventListener("open", open, { once: true });
		socket.addEventListener("error", error, { once: true });
		socket.addEventListener("close", close, { once: true });
		signal?.addEventListener("abort", abort, { once: true });
	});
};
