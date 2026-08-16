declare const protocolBrand: unique symbol;

/** A compile-time collection of named request and subscription signatures. */
export type Protocol = {
	readonly requests?: object;
	readonly subscriptions?: object;
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

/** A protocol operation. */
export type Operation = (...arguments_: any[]) => unknown;

/** The request operations declared by a protocol. */
export type Requests<P> = P extends { readonly requests: infer Operations } ? Operations : Record<never, never>;

/** The subscription operations declared by a protocol. */
export type Subscriptions<P> = P extends { readonly subscriptions: infer Operations }
	? Operations
	: Record<never, never>;

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
