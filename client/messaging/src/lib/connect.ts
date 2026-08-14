import {
	callSafely,
	connectionClosedError,
	errorRecord,
	inactiveSubscription,
	isWireMessage,
	noop,
	post,
	protocol,
	remoteError,
	report,
} from "./.internals.js";
import type * as T from "./.types.js";
import type {
	Client,
	ClientOperation,
	EventListener,
	MessageEndpoint,
	MessageEventLike,
	OperationKind,
	Protocol,
	ProtocolDefinition,
	RequestOptions,
	SubscribeOptions,
	Subscription,
} from "./.types.js";

/**
 * Connects a typed client to a worker or message port.
 *
 * The endpoint becomes protocol-owned until the client closes. Closing the client does not close or terminate the
 * underlying transport.
 */
export function connect<const P extends Protocol & ProtocolDefinition<P>>(endpoint: MessageEndpoint): Client<P> {
	const operations = new Map<number, ClientOperation>();
	const closed = Promise.withResolvers<void>();

	let nextId = 0;
	let isClosed = false;

	const receive = ({ data }: MessageEventLike): void => {
		if (!isWireMessage(data)) {
			return;
		}

		if (data[1] === "close") {
			finish(remoteError(data[2]), true);

			return;
		}

		if (data[1] !== "next" && data[1] !== "resolve" && data[1] !== "reject") {
			return;
		}

		const id = data[2];
		const operation = operations.get(id);

		if (!operation) {
			return;
		}

		if (data[1] === "next") {
			try {
				operation.next(data[3]);
			} catch (error) {
				report(error);
			}
		} else {
			operations.delete(id);
			operation.off();
			operation.settle(data[1] === "resolve", data[1] === "resolve" ? data[3] : remoteError(data[3]));
		}
	};

	const cancel = (id: number): boolean => {
		const operation = operations.get(id);

		if (!operation) {
			return false;
		}

		operations.delete(id);
		operation.off();

		try {
			post(endpoint, [protocol, "cancel", id]);
		} catch {}

		return true;
	};

	const open = (
		kind: OperationKind,
		name: string,
		input: unknown,
		options: RequestOptions,
		next: (value: unknown) => void,
		settle: (ok: boolean, value: unknown) => void,
		onAbort: (reason: unknown) => void,
	): number => {
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
			post(endpoint, [protocol, kind, id, name, input], options.transfer);
		} catch (error) {
			operations.delete(id);
			off();
			throw error;
		}

		return id;
	};

	const finish = (error: unknown, remote: boolean): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		endpoint.removeEventListener("message", receive);

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

	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}

		const error = connectionClosedError(reason);

		try {
			post(endpoint, [protocol, "close", errorRecord(error)]);
		} catch {}

		finish(error, false);
	};

	endpoint.addEventListener("message", receive);
	endpoint.start?.();

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
					"request",
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
			listenerOrOptions?: EventListener | SubscribeOptions,
			maybeOptions?: SubscribeOptions,
		): Subscription {
			if (isClosed) {
				throw connectionClosedError();
			}

			const noInput = typeof inputOrListener === "function";
			const input = noInput ? undefined : inputOrListener;
			const listener = (noInput ? inputOrListener : listenerOrOptions) as EventListener;
			const options = (noInput ? listenerOrOptions : maybeOptions) as SubscribeOptions | undefined;

			let active = !options?.signal?.aborted;

			if (!active) {
				return inactiveSubscription;
			}

			const id = open(
				"subscription",
				name,
				input,
				Object(options),
				listener,
				(ok, value) => {
					active = false;

					if (ok) {
						callSafely(() => options?.onComplete?.(), undefined);
					} else if (options?.onError) {
						callSafely(options.onError, value instanceof Error ? value : remoteError(errorRecord(value)));
					} else {
						report(value);
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
	/** A typed, disposable connection used to request and subscribe to remote operations. */
	export type Client<P extends T.Protocol = T.Protocol> = T.Client<P>;

	/** An endpoint compatible with workers and message ports. */
	export type MessageEndpoint = T.MessageEndpoint;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** Extracts the inline protocol retained by a client, server, or listener. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** Options for sending and cancelling a request. */
	export type RequestOptions = T.RequestOptions;

	/** Options for sending, cancelling, and observing the completion of a subscription. */
	export type SubscribeOptions = T.SubscribeOptions;

	/** A disposable handle for one active subscription. */
	export type Subscription = T.Subscription;
}
