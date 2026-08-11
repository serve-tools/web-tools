declare const transferBrand: unique symbol;

/** Describes one request or subscription operation. */
export interface WorkerOperation<Input = void, Output = void> {
	/** The structured-clone input accepted by the operation. */
	readonly input: Input;

	/** The structured-clone value returned or emitted by the operation. */
	readonly output: Output;
}

/** A collection of named request and subscription operations. */
export type WorkerProtocol = {
	/** Named operations that settle with one promised result. */
	readonly requests: {
		readonly [Name: string]: any;
	};

	/** Named operations that emit zero or more values before settling. */
	readonly subscriptions: {
		readonly [Name: string]: any;
	};
};

/** An endpoint compatible with workers and message ports. */
export interface MessageEndpoint {
	/** Sends a structured-clone message and optionally transfers ownership of transferable objects. */
	postMessage(message: unknown, transfer?: readonly Transferable[]): void;

	/** Registers the protocol's message listener. */
	addEventListener(type: "message", listener: (event: MessageEventLike) => void): void;

	/** Removes the protocol's message listener. */
	removeEventListener(type: "message", listener: (event: MessageEventLike) => void): void;

	/** Starts delivery for endpoints such as a `MessagePort`; called automatically when present. */
	start?(): void;
}

/** Options for sending and cancelling a request. */
export interface WorkerRequestOptions {
	/** Cancels the operation locally and aborts its server-side context. */
	readonly signal?: AbortSignal;

	/** Objects whose ownership is transferred with the operation input. */
	readonly transfer?: readonly Transferable[];
}

/** Options for sending, cancelling, and observing the completion of a subscription. */
export interface WorkerSubscribeOptions extends WorkerRequestOptions {
	/** Called when the server completes the subscription normally. */
	readonly onComplete?: () => void;

	/** Called with a remote or transport error when the subscription fails. */
	readonly onError?: (error: Error) => void;
}

/** State supplied to a request handler. */
export interface WorkerRequestContext {
	/** Aborts when the caller cancels or either side closes the operation. */
	readonly signal: AbortSignal;
}

/** Controls event delivery and settlement from a subscription handler. */
export interface WorkerSubscriptionContext<Value> extends WorkerRequestContext {
	/** Emits one structured-clone value, optionally with a transfer list. */
	emit(value: Value | WorkerTransferResult<Value>): void;

	/** Completes the subscription successfully. */
	complete(): void;

	/** Fails the subscription and delivers a serialized error to the client. */
	error(reason: unknown): void;
}

/** A result value paired with objects whose ownership should be transferred. */
export interface WorkerTransferResult<Value> {
	/** The structured-clone value to send. */
	readonly value: Value;

	/** Objects transferred with the value. */
	readonly transfer: readonly Transferable[];
	readonly [transferBrand]: true;
}

/** A disposable handle for one active subscription. */
export interface WorkerSubscription extends Disposable {
	/** Whether the subscription can still receive values. */
	readonly active: boolean;

	/** Cancels the subscription. Calling it more than once has no effect. */
	unsubscribe(): void;
}

/** A typed, disposable connection used to request and subscribe to remote operations. */
export interface WorkerClient<P extends WorkerProtocol> extends Disposable {
	/** Sends a named request and resolves with its remote result. */
	request<Name extends RequestName<P>>(
		name: Name,
		...arguments_: RequestArguments<P["requests"][Name]>
	): Promise<OutputOf<P["requests"][Name]>>;

	/** Opens a named subscription and returns its disposable local handle. */
	subscribe<Name extends SubscriptionName<P>>(
		name: Name,
		...arguments_: SubscribeArguments<P["subscriptions"][Name]>
	): WorkerSubscription;

	/** Resolves after either peer closes the protocol connection. */
	readonly closed: Promise<void>;

	/** Closes the protocol connection without closing or terminating its underlying endpoint. */
	close(reason?: unknown): void;
}

/** A disposable server attached to one message endpoint. */
export interface WorkerServer<_P extends WorkerProtocol = WorkerProtocol> extends Disposable {
	/** Resolves after either peer closes the protocol connection. */
	readonly closed: Promise<void>;

	/** Aborts active handlers and closes the protocol without closing its underlying endpoint. */
	close(reason?: unknown): void;
}

/** Handler tables implementing every request and subscription in a protocol. */
export type WorkerHandlers<P extends WorkerProtocol> = {
	/** Request handlers, keyed by the names declared in the protocol. */
	readonly requests: {
		readonly [Name in keyof P["requests"]]: (
			input: InputOf<P["requests"][Name]>,
			context: WorkerRequestContext,
		) => Awaitable<OutputOf<P["requests"][Name]> | WorkerTransferResult<OutputOf<P["requests"][Name]>>>;
	};

	/** Subscription handlers, keyed by the names declared in the protocol. */
	readonly subscriptions: {
		readonly [Name in keyof P["subscriptions"]]: (
			input: InputOf<P["subscriptions"][Name]>,
			context: WorkerSubscriptionContext<OutputOf<P["subscriptions"][Name]>>,
		) => Awaitable<SubscriptionHandlerResult>;
	};
};

export interface MessageEventLike {
	readonly data: unknown;
}

export interface ErrorRecord {
	readonly name: string;
	readonly message: string;
	readonly stack?: string;
}

export type InputOf<Value> = Value extends WorkerOperation<infer Input, unknown> ? Input : never;
export type OutputOf<Value> = Value extends WorkerOperation<unknown, infer Output> ? Output : never;
export type RequestName<P extends WorkerProtocol> = Extract<keyof P["requests"], string>;
export type SubscriptionName<P extends WorkerProtocol> = Extract<keyof P["subscriptions"], string>;
type NoInput = ReturnType<() => void>;
export type RequestArguments<Value> = [InputOf<Value>] extends [NoInput]
	? [input?: undefined, options?: WorkerRequestOptions]
	: [input: InputOf<Value>, options?: WorkerRequestOptions];
export type SubscribeArguments<Value> = [InputOf<Value>] extends [NoInput]
	? [onEvent: (value: OutputOf<Value>) => void, options?: WorkerSubscribeOptions]
	: [input: InputOf<Value>, onEvent: (value: OutputOf<Value>) => void, options?: WorkerSubscribeOptions];
export type Awaitable<Value> = Value | PromiseLike<Value>;
export type SubscriptionHandlerResult = ReturnType<() => void> | (() => void);
export type EventListener = (value: unknown) => void;
export type OperationKind = "request" | "subscription";
export type Outcome = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown };
export type SendResult = { readonly ok: true } | { readonly ok: false; readonly error: unknown };
export type Settlement =
	| { readonly ok: true; readonly data: unknown }
	| { readonly ok: false; readonly error: ErrorRecord };

export interface OpenMessage {
	readonly protocol: string;
	readonly type: "open";
	readonly id: number;
	readonly kind: OperationKind;
	readonly name: string;
	readonly data: unknown;
}

export type WireMessage =
	| OpenMessage
	| { readonly protocol: string; readonly type: "next"; readonly id: number; readonly data: unknown }
	| ({ readonly protocol: string; readonly type: "settle"; readonly id: number } & Settlement)
	| { readonly protocol: string; readonly type: "cancel"; readonly id: number }
	| { readonly protocol: string; readonly type: "close"; readonly error: ErrorRecord };

export interface ClientOperation {
	readonly kind: OperationKind;
	readonly next: EventListener;
	readonly settle: (outcome: Outcome) => void;
	readonly cancel: (reason: unknown) => void;
	readonly off: () => void;
}

export interface ServerOperation extends AbortController {
	cleanup?: () => void;
}

export type AnyHandler = (
	input: unknown,
	context: WorkerRequestContext | WorkerSubscriptionContext<unknown>,
) => Awaitable<unknown>;
