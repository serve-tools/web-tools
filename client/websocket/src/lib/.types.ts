declare const protocolBrand: unique symbol;

/** A compile-time collection of named request and subscription signatures. */
export type Protocol = {
	readonly requests?: object;
	readonly subscriptions?: object;
};

/** Options for opening a WebSocket protocol client. */
export interface ConnectOptions {
	/** WebSocket subprotocols offered during the opening handshake. */
	readonly protocols?: string | string[];

	/** Aborts the opening handshake. */
	readonly signal?: AbortSignal;
}

/** Options for sending and cancelling a request. */
export interface RequestOptions {
	/** Cancels the operation locally and asks the server to abort its handler. */
	readonly signal?: AbortSignal;
}

/** Options for sending, cancelling, and observing the completion of a subscription. */
export interface SubscribeOptions extends RequestOptions {
	/** Called when the server completes the subscription normally. */
	readonly onComplete?: () => void;

	/** Called when the server rejects the subscription or the connection fails. */
	readonly onError?: (error: Error) => void;
}

/** A disposable handle for one active subscription. */
export interface Subscription extends Disposable {
	/** Whether the subscription can still receive events. */
	readonly active: boolean;

	/** Cancels the subscription. Calling it more than once has no effect. */
	unsubscribe(): void;
}

/** A typed, disposable WebSocket protocol client. */
export interface Client<P extends Protocol = Protocol> extends Disposable {
	/** Sends a named request and resolves with its remote response. */
	request<Name extends RequestName<P>>(
		name: Name,
		...arguments_: RequestArguments<RequestOperation<P, Name>>
	): Promise<RequestOutput<RequestOperation<P, Name>>>;

	/** Opens a named subscription and returns its disposable local handle. */
	subscribe<Name extends SubscriptionName<P>>(
		name: Name,
		...arguments_: SubscribeArguments<SubscriptionOperation<P, Name>>
	): Subscription;

	/** Resolves after the protocol or its WebSocket connection closes. */
	readonly closed: Promise<void>;

	/** Closes the protocol and its WebSocket connection. */
	close(reason?: unknown): void;

	readonly [protocolBrand]: P;
}

/** Extracts the inline protocol retained by a resolved or pending client. */
export type ProtocolType<Value> =
	Awaited<Value> extends { readonly [protocolBrand]: infer P extends Protocol } ? P : never;

export type ProtocolDefinition<P> = {
	readonly [Section in keyof P]: Section extends "requests" | "subscriptions"
		? P[Section] extends object
			? OperationDefinitions<P[Section]>
			: never
		: never;
};

export type OperationDefinitions<Operations> = {
	readonly [Name in keyof Operations]: Operations[Name] extends (...arguments_: infer Arguments) => infer Output
		? Arguments extends [] | [unknown]
			? (...arguments_: Arguments) => Output
			: never
		: never;
};

export type Requests<P> = P extends { readonly requests: infer Operations } ? Operations : Record<never, never>;
export type Subscriptions<P> = P extends { readonly subscriptions: infer Operations }
	? Operations
	: Record<never, never>;
export type RequestName<P> = Extract<keyof Requests<P>, string>;
export type SubscriptionName<P> = Extract<keyof Subscriptions<P>, string>;
export type RequestOperation<P, Name extends RequestName<P>> = Extract<Requests<P>[Name], Operation>;
export type SubscriptionOperation<P, Name extends SubscriptionName<P>> = Extract<Subscriptions<P>[Name], Operation>;
export type Operation = (...arguments_: any[]) => unknown;
type NoInput = ReturnType<() => void>;
export type OperationInput<Value extends Operation> = Parameters<Value> extends [] ? NoInput : Parameters<Value>[0];
export type RequestOutput<Value extends Operation> = Awaited<ReturnType<Value>>;
export type SubscriptionEvent<Value extends Operation> = ReturnType<Value>;
export type RequestArguments<Value extends Operation> = [OperationInput<Value>] extends [NoInput]
	? [input?: undefined, options?: RequestOptions]
	: [input: OperationInput<Value>, options?: RequestOptions];
export type SubscribeArguments<Value extends Operation> = [OperationInput<Value>] extends [NoInput]
	? [onEvent: (event: SubscriptionEvent<Value>) => void, options?: SubscribeOptions]
	: [input: OperationInput<Value>, onEvent: (event: SubscriptionEvent<Value>) => void, options?: SubscribeOptions];
export interface ErrorRecord {
	readonly name: string;
	readonly message: string;
	readonly stack?: string;
}

export type ClientMessage =
	| readonly [protocol: string, type: "request", id: number, name: string, input: unknown]
	| readonly [protocol: string, type: "subscribe", id: number, name: string, input: unknown]
	| readonly [protocol: string, type: "cancel", id: number]
	| readonly [protocol: string, type: "close", error: ErrorRecord];

export type ServerMessage =
	| readonly [protocol: string, type: "event", id: number, event: unknown]
	| readonly [protocol: string, type: "resolve", id: number, response: unknown]
	| readonly [protocol: string, type: "reject", id: number, error: ErrorRecord]
	| readonly [protocol: string, type: "complete", id: number]
	| readonly [protocol: string, type: "close", error: ErrorRecord];

export interface ClientOperation {
	readonly kind: "request" | "subscription";
	readonly next: (value: unknown) => void;
	readonly settle: (ok: boolean, value: unknown) => void;
	readonly cancel: (reason: unknown) => void;
	readonly off: () => void;
}
