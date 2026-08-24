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

/** Resource limits for one typed realtime client. */
export interface ClientOptions {
	/** Maximum serialized message length accepted from the peer. Defaults to 16 MiB. */
	readonly maximumMessageLength?: number;
}

/** Options for sending and cancelling a request. */
export interface RequestOptions {
	/** Cancels only this operation when aborted. */
	readonly signal?: AbortSignal;
}

/** Options for sending, cancelling, and observing a subscription. */
export interface SubscribeOptions extends RequestOptions {
	/** Runs when the peer completes the subscription successfully. */
	readonly onComplete?: () => void;

	/** Receives remote, transport, or protocol failures for this subscription. */
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

/** Input and cancellation arguments accepted by a typed request. */
export type RequestArguments<Value extends Operation> = [OperationInput<Value>] extends [undefined]
	? [input?: undefined, options?: RequestOptions]
	: [input: OperationInput<Value>, options?: RequestOptions];

/** Input, event listener, and lifecycle arguments accepted by a typed subscription. */
export type SubscribeArguments<Value extends Operation> = [OperationInput<Value>] extends [undefined]
	? [onEvent: (event: SubscriptionEvent<Value>) => void, options?: SubscribeOptions]
	: [input: OperationInput<Value>, onEvent: (event: SubscriptionEvent<Value>) => void, options?: SubscribeOptions];

/** The lifecycle callbacks associated with one active realtime operation. */
export interface ClientOperation {
	/** Whether this operation is a request or subscription. */
	readonly kind: "request" | "subscription";

	/** Delivers the next subscription event. */
	readonly next: (value: unknown) => void;

	/** Settles the operation with its successful result or failure. */
	readonly settle: (ok: boolean, value: unknown) => void;

	/** Cancels the operation with the supplied reason. */
	readonly cancel: (reason: unknown) => void;

	/** Removes the operation's cancellation listener. */
	readonly off: () => void;
}
