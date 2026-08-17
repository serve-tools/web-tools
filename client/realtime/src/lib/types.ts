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
	readonly active: boolean;
	unsubscribe(): void;
}

/** A typed request and subscription client. */
export interface Client<P extends Protocol = Protocol> extends Disposable, ProtocolResource<P> {
	request<Name extends RequestName<P>>(
		name: Name,
		...arguments_: RequestArguments<RequestOperation<P, Name>>
	): Promise<RequestOutput<RequestOperation<P, Name>>>;
	subscribe<Name extends SubscriptionName<P>>(
		name: Name,
		...arguments_: SubscribeArguments<SubscriptionOperation<P, Name>>
	): Subscription;
	readonly closed: Promise<void>;
	close(reason?: unknown): void;
}

/** A typed client plus the receive-side methods used by a transport adapter. */
export interface ClientConnection<P extends Protocol = Protocol> extends Client<P> {
	receive(payload: ArrayBuffer | ArrayBufferView): void;
	fail(reason?: unknown): void;
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
