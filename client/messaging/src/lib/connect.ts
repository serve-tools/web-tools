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
import type {
	ClientOperation,
	EventListener,
	MessageEndpoint,
	MessageEventLike,
	OperationKind,
	WorkerClient,
	WorkerProtocol,
	WorkerRequestOptions,
	WorkerSubscribeOptions,
	WorkerSubscription,
} from "./.types.js";

/**
 * Connects a typed client to a worker or message port.
 *
 * The endpoint becomes protocol-owned until the client closes. Closing the client does not close or terminate the
 * underlying transport.
 */
export function connect<P extends WorkerProtocol>(endpoint: MessageEndpoint): WorkerClient<P> {
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
		options: WorkerRequestOptions,
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
		request(name: string, input?: unknown, options: WorkerRequestOptions = {}): Promise<unknown> {
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
			listenerOrOptions: EventListener | WorkerSubscribeOptions,
			maybeOptions: WorkerSubscribeOptions = null as unknown as WorkerSubscribeOptions,
		): WorkerSubscription {
			if (isClosed) {
				throw connectionClosedError();
			}

			const noInput = typeof inputOrListener === "function";
			const input = noInput ? undefined : inputOrListener;
			const listener = (noInput ? inputOrListener : listenerOrOptions) as EventListener;
			const options = (noInput ? listenerOrOptions : maybeOptions) as WorkerSubscribeOptions | undefined;

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
	} as WorkerClient<P>;
}
