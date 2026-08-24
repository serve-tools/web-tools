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
		options?: {
			/** Cancels the pending read and its page-local datagram subscription. */
			readonly signal?: AbortSignal;
		},
	): Promise<ReceivedDatagramValue<ServerDatagramValue<P, Name>>>;
}

/** A typed page client for a WebTransport session owned by a `SharedWorker`. */
export interface SharedWebTransportClient<P extends Protocol = Protocol> extends Disposable {
	readonly [clientBrand]?: P;

	/** Best-effort datagrams routed through the worker-owned WebTransport session. */
	readonly datagrams: SharedClientDatagrams<P>;

	/** Resolves after either side closes this page's worker protocol connection. */
	readonly closed: Promise<void>;

	/** Sends a named reliable request through the worker-owned session. */
	request: import("@serve-tools/client-webtransport").Client<P>["request"];

	/** Subscribes this page to reliable events from the worker-owned session. */
	subscribe: import("@serve-tools/client-webtransport").Client<P>["subscribe"];

	/** Closes this page's protocol connection without closing the shared session. */
	close(reason?: unknown): void;
}

/** Owns one WebTransport session and every page protocol server attached to the current `SharedWorker`. */
export interface SharedWebTransportServer<P extends Protocol = Protocol> extends Disposable {
	readonly [serverBrand]?: P;

	/** The WebTransport protocol client opened and owned by this worker server. */
	readonly webtransport: Promise<import("@serve-tools/client-webtransport").Client<P>>;

	/** Resolves after the worker server and its WebTransport session close. */
	readonly closed: Promise<void>;

	/** Stops accepting ports and closes the worker-owned WebTransport session. */
	close(reason?: unknown): void;
}

/** Extracts the protocol retained by a shared WebTransport client or server. */
export type ProtocolType<Value> =
	| WebTransportProtocolType<Value>
	| (Awaited<Value> extends SharedWebTransportClient<infer P> | SharedWebTransportServer<infer P> ? P : never);

/** Validates the reliable operations and datagram channels accepted by a shared WebTransport client. */
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

/** The reliable-operation and datagram protocol exchanged between a page and its shared worker. */
export type SharedWebTransportBridgeProtocol = {
	/** Reliable page requests forwarded to the worker-owned WebTransport session. */
	requests: {
		/** Forwards one named reliable request and its input to the shared worker. */
		request(input: SharedOperation): unknown;

		/** Writes one named datagram through the worker-owned session. */
		datagramWrite(input: SharedDatagram): void;

		/** Returns the native session's current maximum datagram size. */
		datagramMaximumSize(): number;
	};

	/** Reliable and datagram subscriptions forwarded to the shared worker. */
	subscriptions: {
		/** Forwards one named reliable subscription and its input to the shared worker. */
		subscribe(input: SharedOperation): unknown;

		/** Subscribes to one named datagram channel on the worker-owned session. */
		datagramSubscribe(input: { readonly name: string }): unknown;
	};
};

/** A named reliable operation forwarded between a page and its shared worker. */
export interface SharedOperation {
	/** The application-defined request or subscription name. */
	readonly name: string;

	/** The structured-clone input supplied by the page client. */
	readonly input: unknown;
}

/** A named datagram forwarded between a page and its shared worker. */
export interface SharedDatagram {
	/** The application-defined datagram channel name. */
	readonly name: string;

	/** The structured-clone datagram value supplied by the page client. */
	readonly value: unknown;
}
