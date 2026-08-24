import type { RequestOptions, SubscribeOptions, Subscription } from "@serve-tools/client-realtime";
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

export type * from "@serve-tools/client-realtime";

/** Identifies the HTTP operation supplied to a dynamic header provider. */
export interface OperationRequest {
	/** Whether this exchange is a request or streaming subscription. */
	readonly kind: "request" | "subscription";

	/** The declared request or subscription operation name. */
	readonly name: string;
}

/** Creates author-controlled headers for one HTTP operation. */
export type HeaderProvider = (operation: OperationRequest) => HeadersInit | PromiseLike<HeadersInit>;

/** Fetch configuration and resource limits for one HTTP-stream client. */
export interface ConnectOptions extends Omit<RequestInit, "body" | "headers" | "method" | "signal"> {
	/** Maximum serialized response message length accepted from the server. Defaults to 16 MiB. */
	readonly maximumMessageLength?: number;

	/** Closes the client and cancels every exchange when aborted. */
	readonly signal?: AbortSignal;

	/** Static author headers or a provider invoked for each operation. */
	readonly headers?: HeadersInit | HeaderProvider;

	/** The Fetch implementation used for every HTTP exchange. */
	readonly fetch?: typeof globalThis.fetch;
}

/** A typed request and streaming-subscription client over HTTP. */
export interface Client<P extends Protocol = Protocol> extends Disposable, ProtocolResource<P> {
	/** Sends a named HTTP request and resolves with its decoded result. */
	request<Name extends RequestName<P>>(
		name: Name,
		...arguments_: RequestArguments<RequestOperation<P, Name>>
	): Promise<RequestOutput<RequestOperation<P, Name>>>;

	/** Opens a named streaming subscription and returns its disposable handle. */
	subscribe<Name extends SubscriptionName<P>>(
		name: Name,
		...arguments_: SubscribeArguments<SubscriptionOperation<P, Name>>
	): Subscription;

	/** Resolves when the client and all active HTTP exchanges close. */
	readonly closed: Promise<void>;

	/** Closes the client and aborts every active HTTP exchange. */
	close(reason?: unknown): void;
}

/** Input and cancellation arguments accepted by a typed request. */
export type RequestArguments<Value extends Operation> = [OperationInput<Value>] extends [undefined]
	? [input?: undefined, options?: RequestOptions]
	: [input: OperationInput<Value>, options?: RequestOptions];

/** Input, event listener, and lifecycle arguments accepted by a typed subscription. */
export type SubscribeArguments<Value extends Operation> = [OperationInput<Value>] extends [undefined]
	? [onEvent: (event: SubscriptionEvent<Value>) => void, options?: SubscribeOptions]
	: [input: OperationInput<Value>, onEvent: (event: SubscriptionEvent<Value>) => void, options?: SubscribeOptions];
