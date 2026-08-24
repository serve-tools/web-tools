import type {
	ClientDatagramName,
	ClientDatagramValue,
	Protocol,
	ProtocolResource,
	ReceivedDatagramValue,
	ServerDatagramName,
	ServerDatagramValue,
} from "@serve-tools/realtime-protocol";
import type { Awaitable, ConnectionOptions, Handlers as OperationHandlers } from "@serve-tools/server-realtime";

export type {
	ClientDatagramName,
	ClientDatagramValue,
	DatagramName,
	Datagrams,
	Protocol,
	ProtocolDefinition,
	ProtocolType,
	ReceivedDatagramValue,
	ServerDatagramName,
	ServerDatagramValue,
} from "@serve-tools/realtime-protocol";
export type * from "@serve-tools/server-realtime";

/** Transport-specific options applied to outgoing datagrams from a writable stream. */
export interface DatagramWritableOptions {
	/** Optional transport-defined datagram scheduling group. */
	readonly sendGroup?: object;

	/** Optional transport-defined scheduling order within the send group. */
	readonly sendOrder?: number;
}

/** Cancellation options for reading one incoming datagram. */
export interface DatagramReadOptions {
	/** Aborts the pending read and removes its datagram subscription. */
	readonly signal?: AbortSignal;
}

/** Typed server-to-client writes and client-to-server datagram subscriptions. */
export interface ServerDatagrams<P extends Protocol> {
	/** Maximum datagram payload size reported by the transport, or positive infinity. */
	readonly maxDatagramSize: number;

	/** Registers a server datagram name when necessary and sends one value to the client. */
	write<Name extends ServerDatagramName<P>>(name: Name, value: ServerDatagramValue<P, Name>): Promise<void>;

	/** Creates a writable stream that sends values for the specified server datagram name. */
	createWritable<Name extends ServerDatagramName<P>>(
		name: Name,
		options?: DatagramWritableOptions,
	): WritableStream<ServerDatagramValue<P, Name>>;

	/** Subscribes to incoming client datagrams with the specified registered name. */
	subscribe<Name extends ClientDatagramName<P>>(
		name: Name,
		listener: (value: ReceivedDatagramValue<ClientDatagramValue<P, Name>>) => void,
	): DatagramSubscription;

	/** Resolves with the next incoming client datagram for the specified name. */
	read<Name extends ClientDatagramName<P>>(
		name: Name,
		options?: DatagramReadOptions,
	): Promise<ReceivedDatagramValue<ClientDatagramValue<P, Name>>>;
}

/** A disposable subscription to incoming client datagrams. */
export interface DatagramSubscription extends Disposable {
	/** Whether the subscription still receives datagrams. */
	readonly active: boolean;

	/** Stops receiving datagrams and removes the associated listener. */
	unsubscribe(): void;
}

/** Connection state and datagram controls supplied to an incoming datagram handler. */
export interface DatagramContext<P extends Protocol, Context> {
	/** Aborts when the WebTransport session closes. */
	readonly signal: AbortSignal;

	/** Application context established when accepting the session. */
	readonly connection: Context;

	/** Typed datagram reads, subscriptions, and server-to-client writes. */
	readonly datagrams: ServerDatagrams<P>;
}

type DatagramHandlers<P extends Protocol, Context> = {
	readonly [Name in ClientDatagramName<P>]: (
		value: ReceivedDatagramValue<ClientDatagramValue<P, Name>>,
		context: DatagramContext<P, Context>,
	) => Awaitable<void>;
};

/** Request, subscription, and incoming client-datagram handlers for a protocol. */
export type Handlers<P extends Protocol, Context = undefined> = OperationHandlers<P, Context> &
	(ClientDatagramName<P> extends never ? object : { readonly datagrams: DatagramHandlers<P, Context> });

/** Reliable-stream, best-effort datagram, and close operations supplied by a transport. */
export interface SessionTransport {
	/** Sends bytes on the reliable request and subscription stream. */
	sendOperations(payload: Uint8Array): void;

	/** Sends bytes on the reliable datagram-registration control stream. */
	sendRegistry(payload: Uint8Array): void;

	/** Sends one best-effort datagram and optionally reports whether the transport accepted it. */
	sendDatagram(payload: Uint8Array, options?: DatagramWritableOptions): Awaitable<boolean | undefined>;

	/** Closes the physical transport with a protocol-compatible status code and reason. */
	close(code: number, reason: string): void;

	/** Maximum datagram payload size reported by the physical transport, when available. */
	readonly maxDatagramSize?: number;
}

/** Protocol limits and failure hooks applied to one WebTransport session. */
export interface SessionOptions extends ConnectionOptions {}

/** A disposable typed WebTransport session spanning operation, registry, and datagram channels. */
export interface Session<P extends Protocol = Protocol, Context = undefined> extends Disposable, ProtocolResource<P> {
	/** Application context established when accepting the session. */
	readonly context: Context;

	/** Resolves after the protocol connection and its active handlers finish. */
	readonly closed: Promise<void>;

	/** Typed best-effort datagram reads, subscriptions, and writes. */
	readonly datagrams: ServerDatagrams<P>;

	/** Processes the next chunk from the reliable operation stream. */
	receiveOperations(chunk: ArrayBuffer | ArrayBufferView): void;

	/** Verifies and closes the reliable operation stream. */
	finishOperations(): void;

	/** Processes the next chunk from the reliable datagram-registration stream. */
	receiveRegistry(chunk: ArrayBuffer | ArrayBufferView): void;

	/** Verifies and closes the reliable datagram-registration stream. */
	finishRegistry(): void;

	/** Decodes and dispatches one incoming client datagram. */
	receiveDatagram(payload: ArrayBuffer | ArrayBufferView): void;

	/** Closes the protocol session and asks the physical transport to close. */
	close(reason?: unknown): void;

	/** Finishes the protocol session after the physical transport disconnects. */
	disconnect(reason?: unknown): void;
}
