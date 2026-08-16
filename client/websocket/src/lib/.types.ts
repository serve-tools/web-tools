import type {
	Operation,
	OperationInput,
	Protocol,
	ProtocolResource,
	RequestName,
	RequestOperation,
	RequestOutput,
	SubscriptionEvent,
	SubscriptionName,
	SubscriptionOperation,
} from "@serve-tools/realtime-protocol";

export type {
	ClientMessage,
	ErrorRecord,
	Operation,
	OperationInput,
	Protocol,
	ProtocolDefinition,
	ProtocolResource,
	ProtocolType,
	RequestName,
	RequestOperation,
	RequestOutput,
	Requests,
	ServerMessage,
	SubscriptionEvent,
	SubscriptionName,
	SubscriptionOperation,
	Subscriptions,
} from "@serve-tools/realtime-protocol";

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
export interface Client<P extends Protocol = Protocol> extends Disposable, ProtocolResource<P> {
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
}

/** Arguments accepted by one typed client request. */
export type RequestArguments<Value extends Operation> = [OperationInput<Value>] extends [undefined]
	? [input?: undefined, options?: RequestOptions]
	: [input: OperationInput<Value>, options?: RequestOptions];

/** Arguments accepted by one typed client subscription. */
export type SubscribeArguments<Value extends Operation> = [OperationInput<Value>] extends [undefined]
	? [onEvent: (event: SubscriptionEvent<Value>) => void, options?: SubscribeOptions]
	: [input: OperationInput<Value>, onEvent: (event: SubscriptionEvent<Value>) => void, options?: SubscribeOptions];

export interface ClientOperation {
	readonly kind: "request" | "subscription";
	readonly next: (value: unknown) => void;
	readonly settle: (ok: boolean, value: unknown) => void;
	readonly cancel: (reason: unknown) => void;
	readonly off: () => void;
}
