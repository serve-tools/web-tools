import { reportError } from "@serve-tools/polyfill-report-error";
import type { Protocol, ProtocolDefinition } from "@serve-tools/realtime-protocol";
import { decodeDatagram, encodeDatagram } from "@serve-tools/realtime-protocol/datagram";
import { DatagramRegistry } from "@serve-tools/realtime-protocol/datagram-registry";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";
import { createConnection } from "@serve-tools/server-realtime";
import type * as T from "./types.js";
import type {
	DatagramReadOptions,
	DatagramSubscription,
	DatagramWritableOptions,
	Handlers,
	ServerDatagrams,
	Session,
	SessionOptions,
	SessionTransport,
} from "./types.js";

const defaultMaximumDatagramLength = 64 * 1024;

/** Creates one protocol server over separated reliable operation, registry, and datagram channels. */
export function createSession<const P extends Protocol & ProtocolDefinition<P>, Context = undefined>(
	handlers: Handlers<P, Context>,
	transport: SessionTransport,
	context: Context,
	options: SessionOptions = {},
): Session<P, Context> {
	const operationDecoder = new FrameDecoder(options.maximumMessageLength);
	const registry = new DatagramRegistry((payload) => transport.sendRegistry(payload));
	const listeners = new Map<string, Set<(value: unknown) => void>>();
	const subscriptions = new Set<() => void>();
	const pendingReads = new Set<(reason: unknown) => void>();
	const controller = new AbortController();
	const maximumDatagramLength =
		positiveSafeInteger(transport.maxDatagramSize) ??
		positiveSafeInteger(options.maximumMessageLength) ??
		defaultMaximumDatagramLength;
	let datagramsClosed: Error | undefined;
	const datagramHandlers = (
		handlers as { readonly datagrams?: Record<string, (value: unknown, context: unknown) => unknown> }
	).datagrams;
	const connection = createConnection(
		handlers,
		{
			send: (payload) => transport.sendOperations(encodeFrame(payload)),
			close: (code, reason) => transport.close(code, reason),
		},
		context,
		options,
	);
	const datagrams = {
		get maxDatagramSize() {
			return transport.maxDatagramSize ?? Number.POSITIVE_INFINITY;
		},
		async write(name: string, value: unknown): Promise<void> {
			if (datagramsClosed) {
				throw datagramsClosed;
			}

			const accepted = await transport.sendDatagram(encodeDatagram(await registry.register(name), value));

			if (accepted === false) {
				throw new Error("The WebTransport server rejected the datagram send");
			}
		},
		createWritable(name: string, writableOptions?: DatagramWritableOptions): WritableStream<unknown> {
			if (datagramsClosed) {
				throw datagramsClosed;
			}

			const kind = registry.register(name);

			return new WritableStream({
				async write(value) {
					if (datagramsClosed) {
						throw datagramsClosed;
					}

					const accepted = await transport.sendDatagram(encodeDatagram(await kind, value), writableOptions);

					if (accepted === false) {
						throw new Error("The WebTransport server rejected the datagram send");
					}
				},
			});
		},
		subscribe(name: string, listener: (value: unknown) => void): DatagramSubscription {
			if (datagramsClosed) {
				throw datagramsClosed;
			}

			let active = true;
			let current = listeners.get(name);

			if (!current) {
				listeners.set(name, (current = new Set()));
			}

			current.add(listener);

			const unsubscribe = (): void => {
				if (!active) {
					return;
				}

				active = false;

				current?.delete(listener);

				if (current?.size === 0) {
					listeners.delete(name);
				}

				subscriptions.delete(unsubscribe);
			};

			subscriptions.add(unsubscribe);

			return {
				get active() {
					return active;
				},
				unsubscribe,
				[Symbol.dispose]: unsubscribe,
			};
		},
		read(name: string, readOptions: DatagramReadOptions = {}): Promise<unknown> {
			if (datagramsClosed) {
				return Promise.reject(datagramsClosed);
			}

			const signal = readOptions.signal;

			if (signal?.aborted) {
				return Promise.reject(signal.reason);
			}

			return new Promise((resolve, reject) => {
				let subscription: DatagramSubscription;

				const finish = (): void => {
					subscription.unsubscribe();
					pendingReads.delete(close);
					signal?.removeEventListener("abort", abort);
				};
				const close = (reason: unknown): void => {
					finish();
					reject(reason);
				};
				const abort = (): void => close(signal?.reason);

				subscription = (
					datagrams.subscribe as (name: string, listener: (value: unknown) => void) => DatagramSubscription
				)(name, (value) => {
					finish();
					resolve(value);
				});

				pendingReads.add(close);
				signal?.addEventListener("abort", abort, { once: true });
			});
		},
	} as ServerDatagrams<P>;

	const receiveDatagram = (payload: ArrayBuffer | ArrayBufferView): void => {
		try {
			const { kind, value } = decodeDatagram(payload, { maximumArrayBufferLength: maximumDatagramLength });
			const name = registry.name(kind) as
				| import("@serve-tools/realtime-protocol").ClientDatagramName<P>
				| undefined;

			if (!name) {
				return;
			}

			for (const listener of listeners.get(name) ?? []) {
				try {
					listener(value);
				} catch (error) {
					reportError(error);
				}
			}

			const handler =
				datagramHandlers && Object.hasOwn(datagramHandlers, name) ? datagramHandlers[name] : undefined;

			if (handler) {
				Promise.resolve(handler(value, { signal: controller.signal, connection: context, datagrams })).catch(
					reportError,
				);
			}
		} catch (error) {
			connection.fail(error);
		}
	};
	const finishDatagrams = (reason?: unknown): Error => {
		if (datagramsClosed) {
			return datagramsClosed;
		}

		datagramsClosed = connectionClosedError(reason);
		controller.abort(datagramsClosed);
		registry.fail(datagramsClosed);

		for (const close of pendingReads) {
			close(datagramsClosed);
		}

		for (const unsubscribe of subscriptions) {
			unsubscribe();
		}

		listeners.clear();

		return datagramsClosed;
	};
	const finish = (reason?: unknown): void => {
		const error = finishDatagrams(reason);

		connection.disconnect(error);
	};
	const close = (reason?: unknown): void => {
		finishDatagrams(reason);
		connection.close(reason);
	};

	void connection.closed.then(finishDatagrams);

	const session = {
		context,
		closed: connection.closed,
		datagrams,
		receiveOperations(chunk: ArrayBuffer | ArrayBufferView) {
			try {
				for (const frame of operationDecoder.push(chunk)) {
					connection.receive(frame);
				}
			} catch (error) {
				connection.fail(error);
			}
		},
		finishOperations() {
			try {
				operationDecoder.finish();
			} catch (error) {
				connection.fail(error);
			}

			finish();
		},
		receiveRegistry(chunk: ArrayBuffer | ArrayBufferView) {
			try {
				registry.receive(chunk);
			} catch (error) {
				connection.fail(error);
			}
		},
		finishRegistry() {
			try {
				registry.finish();
			} catch (error) {
				finish(error);

				return;
			}

			finish("The reliable datagram registry stream ended");
		},
		receiveDatagram,
		close,
		disconnect: finish,
		[Symbol.dispose]: close,
	} as unknown as Session<P, Context>;

	return session;
}

const connectionClosedError = (reason: unknown = "The connection is closed"): Error =>
	reason instanceof Error
		? reason
		: Object.assign(new Error(String(reason)), {
				name: "ConnectionClosedError",
			});

const positiveSafeInteger = (value: number | undefined): number | undefined =>
	Number.isSafeInteger(value) && (value as number) > 0 ? value : undefined;

/** Types used by {@link createSession}. */
export namespace createSession {
	/** Request, subscription, and incoming datagram handler tables. */
	export type Handlers<P extends T.Protocol, Context = undefined> = T.Handlers<P, Context>;

	/** Protocol limits and failure-formatting hooks for one session. */
	export type Options = T.SessionOptions;

	/** A compile-time collection of named operations and directional datagrams. */
	export type Protocol = T.Protocol;

	/** Extracts the protocol retained by a resolved or pending resource. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** A typed WebTransport session and its reliable and best-effort channels. */
	export type Session<P extends T.Protocol = T.Protocol, Context = undefined> = T.Session<P, Context>;

	/** Reliable-stream, datagram, and physical-close operations supplied by a transport. */
	export type Transport = T.SessionTransport;
}
