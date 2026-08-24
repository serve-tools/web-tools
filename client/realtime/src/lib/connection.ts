/// <reference lib="esnext.disposable" />

import { deserialize, isServerMessage, protocol, serialize } from "@serve-tools/realtime-protocol";
import { defaultMaximumFrameLength } from "@serve-tools/realtime-protocol/stream";
import {
	callSafely,
	connectionClosedError,
	errorRecord,
	MessagePart,
	noop,
	protocolError,
	remoteError,
} from "./internals.js";
import type * as T from "./types.js";
import type {
	ClientConnection,
	ClientOperation,
	ClientOptions,
	ClientTransport,
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SubscribeOptions,
	Subscription,
} from "./types.js";

const enum OperationKind {
	Request = 0,
	Subscription = 1,
}

type OperationRecord = Omit<ClientOperation, "kind"> & {
	readonly kind: OperationKind;
};

const inactiveSubscription: Subscription = Object.freeze({
	active: false,
	unsubscribe: noop,
	[Symbol.dispose]: noop,
});

/** Creates one typed request and subscription client over byte-oriented callbacks. */
export function createClient<const P extends Protocol & ProtocolDefinition<P>>(
	transport: ClientTransport,
	options: ClientOptions = {},
): ClientConnection<P> {
	const maximumMessageLength = options.maximumMessageLength ?? defaultMaximumFrameLength;

	if (!Number.isSafeInteger(maximumMessageLength) || maximumMessageLength < 1) {
		throw new RangeError("The maximum message length must be a positive safe integer");
	}

	const deserializeOptions = { maximumArrayBufferLength: maximumMessageLength } as const;
	const operations = new Map<number, OperationRecord>();
	const closed = Promise.withResolvers<void>();

	let nextId = 0;
	let isClosed = false;

	const send = (message: import("@serve-tools/realtime-protocol").ClientMessage): void => {
		if (isClosed) {
			throw connectionClosedError();
		}
		transport.send(serialize(message));
	};

	const finish = (error: unknown, remote: boolean): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		for (const [id, operation] of operations) {
			operations.delete(id);
			operation.off();

			if (operation.kind === OperationKind.Request || remote) {
				operation.settle(false, error);
			} else {
				operation.cancel(error);
			}
		}

		closed.resolve();
	};

	const fail = (reason?: unknown): void => {
		const error = protocolError(reason);

		try {
			send([protocol, "close", errorRecord(error)]);
		} catch {}

		finish(error, true);

		transport.close(error);
	};

	const receive = (payload: ArrayBuffer | ArrayBufferView): void => {
		if (isClosed) {
			return;
		}

		if (payload.byteLength > maximumMessageLength) {
			fail("The message exceeds the configured maximum length");

			return;
		}

		let message: unknown;

		try {
			message = deserialize(payload, deserializeOptions);
		} catch (error) {
			fail(error);

			return;
		}

		if (!isServerMessage(message)) {
			fail();

			return;
		}

		if (message[MessagePart.Type] === "close") {
			const error = remoteError(message[MessagePart.Id]);

			finish(error, true);

			transport.close(error);

			return;
		}

		const operation = operations.get(message[MessagePart.Id]);

		if (!operation) {
			return;
		}

		if (message[MessagePart.Type] === "event") {
			if (operation.kind !== OperationKind.Subscription) {
				fail("A request received a subscription event");

				return;
			}

			callSafely(operation.next, message[MessagePart.Name]);

			return;
		}

		if (
			(message[MessagePart.Type] === "resolve" && operation.kind !== OperationKind.Request) ||
			(message[MessagePart.Type] === "complete" && operation.kind !== OperationKind.Subscription)
		) {
			fail("The operation received an incompatible settlement");

			return;
		}

		operations.delete(message[MessagePart.Id]);
		operation.off();
		operation.settle(
			message[MessagePart.Type] !== "reject",
			message[MessagePart.Type] === "reject"
				? remoteError(message[MessagePart.Name])
				: message[MessagePart.Type] === "resolve"
					? message[MessagePart.Name]
					: undefined,
		);
	};

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
		kind: OperationKind,
		name: string,
		input: unknown,
		options: RequestOptions | undefined,
		next: (value: unknown) => void,
		settle: (ok: boolean, value: unknown) => void,
		onAbort: (reason: unknown) => void,
	): number => {
		if (nextId >= Number.MAX_SAFE_INTEGER) {
			throw new RangeError("The connection exhausted its operation IDs");
		}

		const id = ++nextId;
		const signal = options?.signal;
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
			send([protocol, kind === OperationKind.Request ? "request" : "subscribe", id, name, input]);
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

		transport.close(error);
	};

	return {
		request(name: string, input?: unknown, options: RequestOptions = {}): Promise<unknown> {
			if (isClosed) {
				return Promise.reject(connectionClosedError());
			}

			if (options.signal?.aborted) {
				return Promise.reject(options.signal.reason);
			}

			return new Promise((resolve, reject) => {
				open(
					OperationKind.Request,
					name,
					input,
					options,
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
			const options = (noInput ? listenerOrOptions : maybeOptions) as SubscribeOptions | undefined;

			let active = !options?.signal?.aborted;

			if (!active) {
				return inactiveSubscription;
			}

			const id = open(
				OperationKind.Subscription,
				name,
				input,
				options,
				listener,
				(ok, value) => {
					active = false;

					if (ok) {
						callSafely(() => options?.onComplete?.(), undefined);
					} else if (options?.onError) {
						callSafely(options.onError, value instanceof Error ? value : remoteError(errorRecord(value)));
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
				get active() {
					return active;
				},
				unsubscribe,
				[Symbol.dispose]: unsubscribe,
			};
		},
		closed: closed.promise,
		close,
		receive,
		fail,
		disconnect: (reason?: unknown) => finish(connectionClosedError(reason), true),
		[Symbol.dispose]: close,
	} as ClientConnection<P>;
}

/** Types used by {@link createClient}. */
export namespace createClient {
	/** A typed client with receive-side controls for a transport adapter. */
	export type Connection<P extends T.Protocol = T.Protocol> = T.ClientConnection<P>;

	/** A compile-time map of named requests and subscriptions. */
	export type Protocol = T.Protocol;

	/** Extracts the protocol associated with a typed realtime client. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** Resource limits for a transport-neutral realtime client. */
	export type Options = T.ClientOptions;

	/** Cancellation options for one realtime request. */
	export type RequestOptions = T.RequestOptions;

	/** Cancellation and lifecycle options for one realtime subscription. */
	export type SubscribeOptions = T.SubscribeOptions;

	/** A disposable handle for one active realtime subscription. */
	export type Subscription = T.Subscription;

	/** Byte-oriented send and close operations supplied by a transport adapter. */
	export type Transport = T.ClientTransport;
}
