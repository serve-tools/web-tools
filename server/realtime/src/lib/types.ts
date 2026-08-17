import type {
	ErrorRecord,
	Operation,
	OperationInput,
	Protocol,
	ProtocolResource,
	RequestOutput,
	ServerMessage,
	SubscriptionEvent,
} from "@serve-tools/realtime-protocol";

export type {
	ErrorRecord,
	Protocol,
	ProtocolDefinition,
	ProtocolType,
} from "@serve-tools/realtime-protocol";

/** A value or promise-like value. */
export type Awaitable<Value> = Value | PromiseLike<Value>;

/** Byte-oriented output and physical-close operations supplied to the sans-I/O core. */
export interface ConnectionTransport {
	/** Sends one complete serialized protocol message and its original envelope. */
	send(payload: ArrayBuffer, message: ServerMessage): void;

	/** Closes the physical transport with a WebSocket-compatible status code and reason. */
	close(code: number, reason: string): void;

	/** Returns bytes currently queued by the physical transport, when observable. */
	bufferedAmount?(): number;
}

/** Per-connection limits and failure hooks. */
export interface ConnectionOptions {
	/** Maximum serialized message length accepted from the client. Defaults to 16 MiB. */
	readonly maximumMessageLength?: number;

	/** Maximum concurrently active operations. Defaults to 1,024. */
	readonly maximumOperations?: number;

	/** Maximum bytes allowed in an observable transport send queue. Defaults to 16 MiB. */
	readonly maximumBufferedAmount?: number;

	/** Converts handler failures to records safe to expose to the remote client. */
	readonly formatError?: (reason: unknown) => ErrorRecord;

	/** Observes cleanup, formatter, or transport failures that cannot be returned to the client. */
	readonly reportError?: (reason: unknown) => void;
}

/** State supplied to a request handler. */
export interface RequestContext<Context = undefined> {
	/** Aborts when the caller cancels or the operation or connection closes. */
	readonly signal: AbortSignal;

	/** Application state established while accepting this connection. */
	readonly connection: Context;
}

/** Controls event delivery and settlement from a subscription handler. */
export interface SubscriptionContext<Value, Context = undefined> extends RequestContext<Context> {
	/** Emits one structured value while the subscription remains active. */
	emit(value: Value): void;

	/** Completes the subscription successfully. */
	complete(): void;

	/** Fails the subscription with an error safe-formatted by the connection. */
	error(reason: unknown): void;
}

/** Handler tables implementing every operation declared by a protocol. */
export type Handlers<P extends Protocol, Context = undefined> = {
	readonly requests: P extends { readonly requests: infer Operations } ? RequestHandlers<Operations, Context> : never;
} & {
	readonly subscriptions: P extends { readonly subscriptions: infer Operations }
		? SubscriptionHandlers<Operations, Context>
		: never;
} extends infer Tables
	? {
			readonly [Section in keyof Tables as Tables[Section] extends never ? never : Section]: Tables[Section];
		}
	: never;

type RequestHandlers<Operations, Context> = {
	readonly [Name in keyof Operations]: (
		input: OperationInput<Extract<Operations[Name], Operation>>,
		context: RequestContext<Context>,
	) => Awaitable<RequestOutput<Extract<Operations[Name], Operation>>>;
};

type SubscriptionHandlers<Operations, Context> = {
	readonly [Name in keyof Operations]: (
		input: OperationInput<Extract<Operations[Name], Operation>>,
		context: SubscriptionContext<SubscriptionEvent<Extract<Operations[Name], Operation>>, Context>,
	) => Awaitable<SubscriptionHandlerResult>;
};

/** Cleanup registered by a subscription handler. */
export type SubscriptionHandlerResult = void | (() => Awaitable<void>);

/** A typed protocol server for one physical connection. */
export interface Connection<P extends Protocol = Protocol, Context = undefined>
	extends Disposable,
		ProtocolResource<P> {
	/** Resolves after the protocol finishes. */
	readonly closed: Promise<void>;

	/** Decodes and handles one complete binary protocol message. */
	receive(payload: ArrayBuffer | ArrayBufferView): void;

	/** Closes the connection because the transport received invalid protocol input. */
	fail(reason?: unknown): void;

	/** Gracefully closes the protocol and asks the physical transport to close. */
	close(reason?: unknown): void;

	/** Finishes the protocol after the physical transport has already disconnected. */
	disconnect(reason?: unknown): void;

	/** Application state established for this connection. */
	readonly context: Context;
}

export type AnyHandler = (
	input: unknown,
	context: RequestContext<unknown> | SubscriptionContext<unknown, unknown>,
) => Awaitable<unknown>;
