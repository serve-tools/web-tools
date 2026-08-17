/// <reference lib="esnext.disposable" />

import { createClient } from "@serve-tools/client-realtime";
import { subprotocol } from "@serve-tools/realtime-protocol";
import { decodeDatagram, encodeDatagram } from "@serve-tools/realtime-protocol/datagram";
import { DatagramRegistry } from "@serve-tools/realtime-protocol/datagram-registry";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";
import type * as T from "./lib/types.js";
import type {
	Client,
	ConnectOptions,
	DatagramReadOptions,
	DatagramWritableOptions,
	Protocol,
	ProtocolDefinition,
	Subscription,
	WebTransportConstructor,
} from "./lib/types.js";

const operationsRole = 0;
const datagramsRole = 1;

/** Opens a protocol-owned WebTransport session with reliable operations and typed best-effort datagrams. */
export async function connect<const P extends Protocol & ProtocolDefinition<P>>(
	url: string | URL,
	options: ConnectOptions = {},
): Promise<Client<P>> {
	const Constructor =
		options.transportConstructor ??
		(globalThis as unknown as { readonly WebTransport?: WebTransportConstructor }).WebTransport;

	if (!Constructor) {
		throw new TypeError("WebTransport is not available in this runtime");
	}
	if (options.signal?.aborted) {
		throw options.signal.reason;
	}

	const transport = new Constructor(url, {
		...(options.congestionControl === undefined ? {} : { congestionControl: options.congestionControl }),
		...(options.requireUnreliable === undefined ? {} : { requireUnreliable: options.requireUnreliable }),
		...(options.serverCertificateHashes === undefined
			? {}
			: { serverCertificateHashes: options.serverCertificateHashes }),
		protocols: [subprotocol],
	});

	await abortable(transport.ready, options.signal, () => transport.close({ reason: "Connection aborted" }));

	if (transport.protocol !== subprotocol) {
		transport.close({ closeCode: 1, reason: "Application protocol required" });

		throw Object.assign(new Error(`Expected the ${subprotocol} WebTransport protocol`), { name: "ProtocolError" });
	}

	const operationStream = await transport.createBidirectionalStream();
	const operationWriter = operationStream.writable.getWriter();
	const operationDecoder = new FrameDecoder();
	let operationWrites = operationWriter.write(Uint8Array.of(operationsRole));
	let client!: ReturnType<typeof createClient<P>>;

	client = createClient<P>({
		send(payload) {
			operationWrites = operationWrites.then(() => operationWriter.write(encodeFrame(payload)));
			void operationWrites.catch((error) => client.disconnect(error));
		},
		close(reason) {
			transport.close({
				closeCode: reason instanceof Error && reason.name === "ProtocolError" ? 1 : 0,
				reason: reason instanceof Error ? reason.message : "",
			});
		},
	});

	void pump(
		operationStream.readable,
		(chunk) => {
			for (const frame of operationDecoder.push(chunk)) {
				client.receive(frame);
			}
		},
		() => operationDecoder.finish(),
	).then(
		() => client.fail("The reliable operation stream ended"),
		(error) => client.disconnect(error),
	);
	void operationWrites.catch((error) => client.disconnect(error));

	const registryStream = await transport.createBidirectionalStream();
	const registryWriter = registryStream.writable.getWriter();
	let registryWrites = registryWriter.write(Uint8Array.of(datagramsRole));
	const registry = new DatagramRegistry((payload) => {
		registryWrites = registryWrites.then(() => registryWriter.write(payload));
		void registryWrites.catch((error) => registry.fail(error));
	});

	void pump(
		registryStream.readable,
		(chunk) => registry.receive(chunk),
		() => registry.finish(),
	).then(
		() => client.fail("The reliable datagram registry stream ended"),
		(error) => {
			registry.fail(error);
			client.disconnect(error);
		},
	);
	void registryWrites.catch((error) => client.disconnect(error));

	const listeners = new Map<string, Set<(value: unknown) => void>>();
	const sharedDatagramWriter = transport.datagrams.createWritable().getWriter();

	void pump(transport.datagrams.readable, (chunk) => {
		const { kind, value } = decodeDatagram(chunk);
		const name = registry.name(kind);

		if (!name) {
			client.fail("A datagram used an unregistered kind");

			return;
		}

		for (const listener of listeners.get(name) ?? []) {
			try {
				listener(value);
			} catch (error) {
				reportError(error);
			}
		}
	}).catch((error) => client.disconnect(error));

	void transport.closed.then(
		() => client.disconnect(),
		(error) => client.disconnect(error),
	);

	const datagrams = {
		get maxDatagramSize() {
			return transport.datagrams.maxDatagramSize;
		},
		async write(name: string, value: unknown): Promise<void> {
			const kind = await registry.register(name);

			await sharedDatagramWriter.write(encodeDatagram(kind, value));
		},
		createWritable(name: string, writableOptions?: DatagramWritableOptions): WritableStream<unknown> {
			const writable = transport.datagrams.createWritable(writableOptions);
			const writer = writable.getWriter();
			const kind = registry.register(name);

			return new WritableStream({
				async write(value) {
					await writer.write(encodeDatagram(await kind, value));
				},
				close: () => writer.close(),
				abort: (reason) => writer.abort(reason),
			});
		},
		subscribe(name: string, listener: (value: unknown) => void): Subscription {
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
				let subscription: Subscription;
				const abort = (): void => {
					subscription.unsubscribe();
					reject(readOptions.signal?.reason);
				};
				subscription = datagrams.subscribe(name, (value) => {
					subscription.unsubscribe();
					readOptions.signal?.removeEventListener("abort", abort);
					resolve(value);
				});
				readOptions.signal?.addEventListener("abort", abort, { once: true });
			});
		},
	};

	return Object.assign(client, { datagrams }) as Client<P>;
}

export namespace connect {
	export type Client<P extends T.Protocol = T.Protocol> = T.Client<P>;
	export type Datagrams<P extends T.Protocol> = T.ClientDatagrams<P>;
	export type Options = T.ConnectOptions;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type RequestOptions = T.RequestOptions;
	export type SubscribeOptions = T.SubscribeOptions;
	export type Subscription = T.Subscription;
}

export { RemoteError } from "@serve-tools/client-realtime";
export type * from "./lib/types.js";

const pump = async (
	readable: ReadableStream<Uint8Array>,
	receive: (chunk: Uint8Array) => void,
	finish?: () => void,
): Promise<void> => {
	const reader = readable.getReader();

	try {
		while (true) {
			const result = await reader.read();
			if (result.done) {
				break;
			}
			receive(result.value);
		}
		finish?.();
	} finally {
		reader.releaseLock();
	}
};

const abortable = async <Value>(
	promise: Promise<Value>,
	signal: AbortSignal | undefined,
	abort: () => void,
): Promise<Value> => {
	if (!signal) {
		return promise;
	}

	return new Promise<Value>((resolve, reject) => {
		const cancelled = (): void => {
			abort();
			reject(signal.reason);
		};

		signal.addEventListener("abort", cancelled, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", cancelled));
	});
};
