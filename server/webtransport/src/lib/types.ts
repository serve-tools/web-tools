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

export interface DatagramWritableOptions {
	readonly sendGroup?: object;
	readonly sendOrder?: number;
}

export interface DatagramReadOptions {
	readonly signal?: AbortSignal;
}

export interface ServerDatagrams<P extends Protocol> {
	readonly maxDatagramSize: number;
	write<Name extends ServerDatagramName<P>>(name: Name, value: ServerDatagramValue<P, Name>): Promise<void>;
	createWritable<Name extends ServerDatagramName<P>>(
		name: Name,
		options?: DatagramWritableOptions,
	): WritableStream<ServerDatagramValue<P, Name>>;
	subscribe<Name extends ClientDatagramName<P>>(
		name: Name,
		listener: (value: ReceivedDatagramValue<ClientDatagramValue<P, Name>>) => void,
	): DatagramSubscription;
	read<Name extends ClientDatagramName<P>>(
		name: Name,
		options?: DatagramReadOptions,
	): Promise<ReceivedDatagramValue<ClientDatagramValue<P, Name>>>;
}

export interface DatagramSubscription extends Disposable {
	readonly active: boolean;
	unsubscribe(): void;
}

export interface DatagramContext<P extends Protocol, Context> {
	readonly signal: AbortSignal;
	readonly connection: Context;
	readonly datagrams: ServerDatagrams<P>;
}

type DatagramHandlers<P extends Protocol, Context> = {
	readonly [Name in ClientDatagramName<P>]: (
		value: ReceivedDatagramValue<ClientDatagramValue<P, Name>>,
		context: DatagramContext<P, Context>,
	) => Awaitable<void>;
};

export type Handlers<P extends Protocol, Context = undefined> = OperationHandlers<P, Context> &
	(ClientDatagramName<P> extends never ? object : { readonly datagrams: DatagramHandlers<P, Context> });

export interface SessionTransport {
	sendOperations(payload: Uint8Array): void;
	sendRegistry(payload: Uint8Array): void;
	sendDatagram(payload: Uint8Array, options?: DatagramWritableOptions): Awaitable<boolean | undefined>;
	close(code: number, reason: string): void;
	readonly maxDatagramSize?: number;
}

export interface SessionOptions extends ConnectionOptions {}

export interface Session<P extends Protocol = Protocol, Context = undefined> extends Disposable, ProtocolResource<P> {
	readonly context: Context;
	readonly closed: Promise<void>;
	readonly datagrams: ServerDatagrams<P>;
	receiveOperations(chunk: ArrayBuffer | ArrayBufferView): void;
	finishOperations(): void;
	receiveRegistry(chunk: ArrayBuffer | ArrayBufferView): void;
	finishRegistry(): void;
	receiveDatagram(payload: ArrayBuffer | ArrayBufferView): void;
	close(reason?: unknown): void;
	disconnect(reason?: unknown): void;
}
