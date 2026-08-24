import type {
	Client as RealtimeClient,
	RequestOptions,
	SubscribeOptions,
	Subscription,
} from "@serve-tools/client-realtime";
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
	/** The native send group used to schedule this writable. */
	readonly sendGroup?: object;

	/** The native scheduling order within the writable's send group. */
	readonly sendOrder?: number;
}

/** Options for reading the next datagram of one kind. */
export interface DatagramReadOptions {
	/** Cancels this pending datagram read when aborted. */
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
export interface Client<P extends Protocol = Protocol> extends RealtimeClient<P> {
	/** The session's typed best-effort datagram operations. */
	readonly datagrams: ClientDatagrams<P>;
}

/** Structural options passed through to the native WebTransport constructor. */
export interface ConnectOptions {
	/** Aborts setup or closes the established WebTransport session. */
	readonly signal?: AbortSignal;

	/** The native congestion-control mode requested for this session. */
	readonly congestionControl?: "default" | "throughput" | "low-latency";

	/** Whether native session setup must provide unreliable datagrams. */
	readonly requireUnreliable?: boolean;

	/** Server certificate digest records supplied to the native constructor. */
	readonly serverCertificateHashes?: readonly { readonly algorithm: string; readonly value: BufferSource }[];

	/** An alternate native-compatible WebTransport constructor. */
	readonly transportConstructor?: WebTransportConstructor;
}

/** The minimal constructor contract required to open a WebTransport session. */
export interface WebTransportConstructor {
	/** Opens a native-compatible session for the supplied URL and options. */
	new (url: string | URL, options?: Record<string, unknown>): WebTransportLike;
}

/** The native-compatible WebTransport session surface used by this client. */
export interface WebTransportLike {
	/** Resolves when the native session is ready to create streams. */
	readonly ready: Promise<void>;

	/** Settles when the native session closes. */
	readonly closed: Promise<unknown>;

	/** The negotiated application protocol for this session. */
	readonly protocol: string;

	/** The session's native-compatible unreliable datagram transport. */
	readonly datagrams: WebTransportDatagramsLike;

	/** Opens an independently ordered bidirectional reliable stream. */
	createBidirectionalStream(): Promise<WebTransportBidirectionalStreamLike>;

	/** Closes the session with an optional application code and reason. */
	close(info?: { readonly closeCode?: number; readonly reason?: string }): void;
}

/** The native-compatible unreliable datagram transport used by this client. */
export interface WebTransportDatagramsLike {
	/** Delivers incoming datagram bytes from the remote peer. */
	readonly readable: ReadableStream<Uint8Array>;

	/** The maximum datagram size reported by the native transport. */
	readonly maxDatagramSize: number;

	/** Creates an independently scheduled outgoing datagram queue. */
	createWritable(options?: DatagramWritableOptions): WritableStream<BufferSource>;
}

/** The native-compatible readable and writable sides of a reliable stream. */
export interface WebTransportBidirectionalStreamLike {
	/** Delivers reliable incoming stream bytes. */
	readonly readable: ReadableStream<Uint8Array>;

	/** Sends reliable outgoing stream bytes. */
	readonly writable: WritableStream<BufferSource>;
}

export type { Protocol, RequestOptions, SubscribeOptions, Subscription };
