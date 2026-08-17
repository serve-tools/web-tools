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
	const controller = new AbortController();
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
			const accepted = await transport.sendDatagram(encodeDatagram(await registry.register(name), value));

			if (accepted === false) {
				throw new Error("The WebTransport server rejected the datagram send");
			}
		},
		createWritable(name: string, writableOptions?: DatagramWritableOptions): WritableStream<unknown> {
			const kind = registry.register(name);

			return new WritableStream({
				async write(value) {
					const accepted = await transport.sendDatagram(encodeDatagram(await kind, value), writableOptions);
					if (accepted === false) {
						throw new Error("The WebTransport server rejected the datagram send");
					}
				},
			});
		},
		subscribe(name: string, listener: (value: unknown) => void): DatagramSubscription {
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
			};

			return {
				get active() {
					return active;
				},
				unsubscribe,
				[Symbol.dispose]: unsubscribe,
			};
		},
		read(name: string, readOptions: DatagramReadOptions = {}): Promise<unknown> {
			if (readOptions.signal?.aborted) {
				return Promise.reject(readOptions.signal.reason);
			}

			return new Promise((resolve, reject) => {
				let subscription: DatagramSubscription;
				const abort = (): void => {
					subscription.unsubscribe();
					reject(readOptions.signal?.reason);
				};
				subscription = (
					datagrams.subscribe as (name: string, listener: (value: unknown) => void) => DatagramSubscription
				)(name, (value) => {
					subscription.unsubscribe();
					readOptions.signal?.removeEventListener("abort", abort);
					resolve(value);
				});
				readOptions.signal?.addEventListener("abort", abort, { once: true });
			});
		},
	} as ServerDatagrams<P>;

	const receiveDatagram = (payload: ArrayBuffer | ArrayBufferView): void => {
		try {
			const { kind, value } = decodeDatagram(payload);
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
					(options.reportError ?? reportError)(error);
				}
			}

			const handler =
				datagramHandlers && Object.hasOwn(datagramHandlers, name) ? datagramHandlers[name] : undefined;

			if (handler) {
				Promise.resolve(handler(value, { signal: controller.signal, connection: context, datagrams })).catch(
					options.reportError ?? reportError,
				);
			}
		} catch (error) {
			connection.fail(error);
		}
	};
	const finish = (reason?: unknown): void => {
		if (!controller.signal.aborted) {
			controller.abort(reason);
		}

		registry.fail(reason);
		connection.disconnect(reason);
	};

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
				connection.fail(error);
			}
		},
		receiveDatagram,
		close: connection.close,
		disconnect: finish,
		[Symbol.dispose]: connection.close,
	} as unknown as Session<P, Context>;

	return session;
}

export namespace createSession {
	export type Handlers<P extends T.Protocol, Context = undefined> = T.Handlers<P, Context>;
	export type Options = T.SessionOptions;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type Session<P extends T.Protocol = T.Protocol, Context = undefined> = T.Session<P, Context>;
	export type Transport = T.SessionTransport;
}
