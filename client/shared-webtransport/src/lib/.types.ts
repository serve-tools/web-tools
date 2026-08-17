/// <reference lib="esnext.disposable" />

import type {
	ConnectOptions,
	Protocol,
	RequestOptions,
	SubscribeOptions,
	Subscription,
	ProtocolType as WebTransportProtocolType,
} from "@serve-tools/client-webtransport";
import type {
	ClientDatagramName,
	ClientDatagramValue,
	ReceivedDatagramValue,
	ServerDatagramName,
	ServerDatagramValue,
} from "@serve-tools/realtime-protocol";

declare const clientBrand: unique symbol;
declare const serverBrand: unique symbol;

export type { ConnectOptions, Protocol, RequestOptions, SubscribeOptions, Subscription };

/** Typed best-effort datagrams routed through a worker-owned WebTransport session. */
export interface SharedClientDatagrams<P extends Protocol> {
	/** Resolves to the native session's current maximum datagram size. */
	readonly maxDatagramSize: Promise<number>;

	/** Writes one typed datagram through the worker's shared native writer. */
	write<Name extends ClientDatagramName<P>>(name: Name, value: ClientDatagramValue<P, Name>): Promise<void>;

	/** Subscribes to future arriving datagrams without replay or buffering. */
	subscribe<Name extends ServerDatagramName<P>>(
		name: Name,
		listener: (value: ReceivedDatagramValue<ServerDatagramValue<P, Name>>) => void,
	): Subscription;

	/** Reads exactly the next arriving datagram of one kind. */
	read<Name extends ServerDatagramName<P>>(
		name: Name,
		options?: { readonly signal?: AbortSignal },
	): Promise<ReceivedDatagramValue<ServerDatagramValue<P, Name>>>;
}

/** A typed page client for a WebTransport session owned by a `SharedWorker`. */
export interface SharedWebTransportClient<P extends Protocol = Protocol> extends Disposable {
	readonly [clientBrand]?: P;
	readonly datagrams: SharedClientDatagrams<P>;
	readonly closed: Promise<void>;
	request: import("@serve-tools/client-webtransport").Client<P>["request"];
	subscribe: import("@serve-tools/client-webtransport").Client<P>["subscribe"];
	close(reason?: unknown): void;
}

/** Owns one WebTransport session and every page protocol server attached to the current `SharedWorker`. */
export interface SharedWebTransportServer<P extends Protocol = Protocol> extends Disposable {
	readonly [serverBrand]?: P;
	readonly webtransport: Promise<import("@serve-tools/client-webtransport").Client<P>>;
	readonly closed: Promise<void>;
	close(reason?: unknown): void;
}

/** Extracts the protocol retained by a shared WebTransport client or server. */
export type ProtocolType<Value> =
	| WebTransportProtocolType<Value>
	| (Awaited<Value> extends SharedWebTransportClient<infer P> | SharedWebTransportServer<infer P> ? P : never);

export type ProtocolDefinition<P> = {
	readonly [Section in keyof P]: Section extends "requests" | "subscriptions" | "datagrams"
		? P[Section] extends object
			? Section extends "datagrams"
				? P[Section]
				: OperationDefinitions<P[Section]>
			: never
		: never;
};

type OperationDefinitions<Operations> = {
	readonly [Name in keyof Operations]: Operations[Name] extends (...arguments_: infer Arguments) => infer Output
		? Arguments extends [] | [unknown]
			? (...arguments_: Arguments) => Output
			: never
		: never;
};

export type SharedWebTransportBridgeProtocol = {
	requests: {
		request(input: SharedOperation): unknown;
		datagramWrite(input: SharedDatagram): void;
		datagramMaximumSize(): number;
	};
	subscriptions: {
		subscribe(input: SharedOperation): unknown;
		datagramSubscribe(input: { readonly name: string }): unknown;
	};
};

export interface SharedOperation {
	readonly name: string;
	readonly input: unknown;
}

export interface SharedDatagram {
	readonly name: string;
	readonly value: unknown;
}
