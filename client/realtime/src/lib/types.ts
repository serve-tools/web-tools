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
	Operation,
	OperationInput,
	Protocol,
	ProtocolDefinition,
	ProtocolResource,
	ProtocolType,
	RequestName,
	RequestOperation,
	RequestOutput,
	SubscriptionEvent,
	SubscriptionName,
	SubscriptionOperation,
} from "@serve-tools/realtime-protocol";

/** Byte-oriented output and physical-close operations supplied to the sans-I/O client. */
export interface ClientTransport {
	/** Sends one complete serialized protocol message. */
	send(payload: ArrayBuffer): void;

	/** Closes the physical transport. */
	close(reason?: unknown): void;
}

/** Options for sending and cancelling a request. */
export interface RequestOptions {
	readonly signal?: AbortSignal;
}

/** Options for sending, cancelling, and observing a subscription. */
export interface SubscribeOptions extends RequestOptions {
	readonly onComplete?: () => void;
	readonly onError?: (error: Error) => void;
}

/** A disposable handle for one active subscription. */
export interface Subscription extends Disposable {
	/** Represents whether the subscription can still receive events or not. */
	readonly active: boolean;

	/** Cancels the subscription. Calling it more than once has no effect. */
	unsubscribe(): void;
}

/** A typed request and subscription client. */
export interface Client<P extends Protocol = Protocol> extends Disposable, ProtocolResource<P> {
	/** Sends a named request and resolves with its remote result. */
	request<Name extends RequestName<P>>(
		name: Name,
		...arguments_: RequestArguments<RequestOperation<P, Name>>
	): Promise<RequestOutput<RequestOperation<P, Name>>>;

	/** Opens a named subscription and returns its disposable local handle. */
	subscribe<Name extends SubscriptionName<P>>(
		name: Name,
		...arguments_: SubscribeArguments<SubscriptionOperation<P, Name>>
	): Subscription;

	/** Represents a promise that resolves when the client is closed. */
	readonly closed: Promise<void>;

	/** Closes the client and its underlying transport. */
	close(reason?: unknown): void;
}

/** A typed client plus the receive-side methods used by a transport adapter. */
export interface ClientConnection<P extends Protocol = Protocol> extends Client<P> {
	/** Decodes and handles one complete binary protocol message. */
	receive(payload: ArrayBuffer | ArrayBufferView): void;

	/** Closes the client because the transport received invalid protocol input. */
	fail(reason?: unknown): void;

	/** Finishes the client after the physical transport has already disconnected. */
	disconnect(reason?: unknown): void;
}

export type RequestArguments<Value extends Operation> = [OperationInput<Value>] extends [undefined]
	? [input?: undefined, options?: RequestOptions]
	: [input: OperationInput<Value>, options?: RequestOptions];

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
