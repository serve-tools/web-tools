declare const protocolBrand: unique symbol;

/** A compile-time collection of named request, subscription, and datagram signatures. */
export type Protocol = {
	readonly requests?: object;
	readonly subscriptions?: object;
	readonly datagrams?: object;
};

/** A resource retaining a protocol type for later extraction. */
export interface ProtocolResource<P extends Protocol = Protocol> {
	readonly [protocolBrand]: P;
}

/** Extracts the inline protocol retained by a resolved or pending resource. */
export type ProtocolType<Value> = Awaited<Value> extends ProtocolResource<infer P> ? P : never;

/** Restricts every protocol operation to zero or one input parameter. */
export type ProtocolDefinition<P> = {
	readonly [Section in keyof P]: Section extends "requests" | "subscriptions"
		? P[Section] extends object
			? OperationDefinitions<P[Section]>
			: never
		: Section extends "datagrams"
			? P[Section] extends object
				? DatagramDefinitions<P[Section]>
				: never
			: never;
};

/** Restricts an operation table to functions accepting zero or one input parameter. */
export type OperationDefinitions<Operations> = {
	readonly [Name in keyof Operations]: Operations[Name] extends (...arguments_: infer Arguments) => infer Output
		? Arguments extends [] | [unknown]
			? (...arguments_: Arguments) => Output
			: never
		: never;
};

/** Restricts datagram declarations to client and server directional values. */
export type DatagramDefinitions<Datagrams> = {
	readonly [Name in keyof Datagrams]: Datagrams[Name] extends {
		readonly client?: unknown;
		readonly server?: unknown;
	}
		? keyof Datagrams[Name] extends "client" | "server"
			? Datagrams[Name]
			: never
		: never;
};

/** A protocol operation. */
export type Operation = (...arguments_: any[]) => unknown;

/** The request operations declared by a protocol. */
export type Requests<P> = P extends { readonly requests: infer Operations } ? Operations : Record<never, never>;

/** The subscription operations declared by a protocol. */
export type Subscriptions<P> = P extends { readonly subscriptions: infer Operations }
	? Operations
	: Record<never, never>;

/** The directional datagrams declared by a protocol. */
export type Datagrams<P> = P extends { readonly datagrams: infer Values } ? Values : Record<never, never>;

/** A declared datagram name. */
export type DatagramName<P> = Extract<keyof Datagrams<P>, string>;

/** A client-to-server datagram name. */
export type ClientDatagramName<P> = {
	readonly [Name in DatagramName<P>]: Datagrams<P>[Name] extends { readonly client: unknown } ? Name : never;
}[DatagramName<P>];

/** A server-to-client datagram name. */
export type ServerDatagramName<P> = {
	readonly [Name in DatagramName<P>]: Datagrams<P>[Name] extends { readonly server: unknown } ? Name : never;
}[DatagramName<P>];

/** The value written by a client for one datagram name. */
export type ClientDatagramValue<P, Name extends ClientDatagramName<P>> = Datagrams<P>[Name] extends {
	readonly client: infer Value;
}
	? Value
	: never;

/** The value written by a server for one datagram name. */
export type ServerDatagramValue<P, Name extends ServerDatagramName<P>> = Datagrams<P>[Name] extends {
	readonly server: infer Value;
}
	? Value
	: never;

/** The receive-side form of a datagram value. Native binary input is normalized to `Uint8Array`. */
export type ReceivedDatagramValue<Value> = Value extends ArrayBuffer | ArrayBufferView ? Uint8Array : Value;

/** A request name declared by a protocol. */
export type RequestName<P> = Extract<keyof Requests<P>, string>;

/** A subscription name declared by a protocol. */
export type SubscriptionName<P> = Extract<keyof Subscriptions<P>, string>;

/** One request operation selected by name. */
export type RequestOperation<P, Name extends RequestName<P>> = Extract<Requests<P>[Name], Operation>;

/** One subscription operation selected by name. */
export type SubscriptionOperation<P, Name extends SubscriptionName<P>> = Extract<Subscriptions<P>[Name], Operation>;

type NoInput = undefined;

/** The declared input of an operation, or `undefined` for a zero-input operation. */
export type OperationInput<Value extends Operation> = Parameters<Value> extends [] ? NoInput : Parameters<Value>[0];

/** The awaited response of a request operation. */
export type RequestOutput<Value extends Operation> = Awaited<ReturnType<Value>>;

/** The event value emitted by a subscription operation. */
export type SubscriptionEvent<Value extends Operation> = ReturnType<Value>;

/** A serialized error sent across the protocol. */
export interface ErrorRecord {
	readonly name: string;
	readonly message: string;
	readonly stack?: string;
}

/** A message sent from a protocol client. */
export type ClientMessage =
	| readonly [protocol: string, type: "request", id: number, name: string, input: unknown]
	| readonly [protocol: string, type: "subscribe", id: number, name: string, input: unknown]
	| readonly [protocol: string, type: "cancel", id: number]
	| readonly [protocol: string, type: "close", error: ErrorRecord];

/** A message sent from a protocol server. */
export type ServerMessage =
	| readonly [protocol: string, type: "event", id: number, event: unknown]
	| readonly [protocol: string, type: "resolve", id: number, response: unknown]
	| readonly [protocol: string, type: "reject", id: number, error: ErrorRecord]
	| readonly [protocol: string, type: "complete", id: number]
	| readonly [protocol: string, type: "close", error: ErrorRecord];
