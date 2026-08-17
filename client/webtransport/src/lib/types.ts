import type { ClientConnection, RequestOptions, SubscribeOptions, Subscription } from "@serve-tools/client-realtime";
import type {
	ClientDatagramName,
	ClientDatagramValue,
	Protocol,
	ReceivedDatagramValue,
	ServerDatagramName,
	ServerDatagramValue,
} from "@serve-tools/realtime-protocol";

export type * from "@serve-tools/client-realtime";
export type {
	ClientDatagramName,
	ClientDatagramValue,
	DatagramName,
	Datagrams,
	ReceivedDatagramValue,
	ServerDatagramName,
	ServerDatagramValue,
} from "@serve-tools/realtime-protocol";

/** Options accepted by one native datagram writable queue. */
export interface DatagramWritableOptions {
	readonly sendGroup?: object;
	readonly sendOrder?: number;
}

/** Options for reading the next datagram of one kind. */
export interface DatagramReadOptions {
	readonly signal?: AbortSignal;
}

/** Typed best-effort datagrams on one protocol-owned WebTransport session. */
export interface ClientDatagrams<P extends Protocol> {
	/** The current native maximum datagram size. The package does not impose another limit. */
	readonly maxDatagramSize: number;

	/** Writes one typed client-to-server datagram. */
	write<Name extends ClientDatagramName<P>>(name: Name, value: ClientDatagramValue<P, Name>): Promise<void>;

	/** Creates an independently scheduled writable for one precise datagram kind. */
	createWritable<Name extends ClientDatagramName<P>>(
		name: Name,
		options?: DatagramWritableOptions,
	): WritableStream<ClientDatagramValue<P, Name>>;

	/** Subscribes locally to arriving server-to-client datagrams of one kind. */
	subscribe<Name extends ServerDatagramName<P>>(
		name: Name,
		listener: (value: ReceivedDatagramValue<ServerDatagramValue<P, Name>>) => void,
	): Subscription;

	/** Reads the next arriving server-to-client datagram of one kind without replay or buffering. */
	read<Name extends ServerDatagramName<P>>(
		name: Name,
		options?: DatagramReadOptions,
	): Promise<ReceivedDatagramValue<ServerDatagramValue<P, Name>>>;
}

/** A typed request, subscription, and datagram WebTransport client. */
export interface Client<P extends Protocol = Protocol> extends ClientConnection<P> {
	readonly datagrams: ClientDatagrams<P>;
}

/** Structural options passed through to the native WebTransport constructor. */
export interface ConnectOptions {
	readonly signal?: AbortSignal;
	readonly congestionControl?: "default" | "throughput" | "low-latency";
	readonly requireUnreliable?: boolean;
	readonly serverCertificateHashes?: readonly { readonly algorithm: string; readonly value: BufferSource }[];
	readonly transportConstructor?: WebTransportConstructor;
}

export interface WebTransportConstructor {
	new (url: string | URL, options?: Record<string, unknown>): WebTransportLike;
}

export interface WebTransportLike {
	readonly ready: Promise<void>;
	readonly closed: Promise<unknown>;
	readonly protocol: string;
	readonly datagrams: WebTransportDatagramsLike;
	createBidirectionalStream(): Promise<WebTransportBidirectionalStreamLike>;
	close(info?: { readonly closeCode?: number; readonly reason?: string }): void;
}

export interface WebTransportDatagramsLike {
	readonly readable: ReadableStream<Uint8Array>;
	readonly maxDatagramSize: number;
	createWritable(options?: DatagramWritableOptions): WritableStream<BufferSource>;
}

export interface WebTransportBidirectionalStreamLike {
	readonly readable: ReadableStream<Uint8Array>;
	readonly writable: WritableStream<BufferSource>;
}

export type { Protocol, RequestOptions, SubscribeOptions, Subscription };
