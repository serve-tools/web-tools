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

export interface OperationRequest {
	readonly kind: "request" | "subscription";
	readonly name: string;
}

export type HeaderProvider = (operation: OperationRequest) => HeadersInit | PromiseLike<HeadersInit>;

export interface ConnectOptions extends Omit<RequestInit, "body" | "headers" | "method" | "signal"> {
	readonly signal?: AbortSignal;
	readonly headers?: HeadersInit | HeaderProvider;
	readonly fetch?: typeof globalThis.fetch;
}

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

export type RequestArguments<Value extends Operation> = [OperationInput<Value>] extends [undefined]
	? [input?: undefined, options?: RequestOptions]
	: [input: OperationInput<Value>, options?: RequestOptions];

export type SubscribeArguments<Value extends Operation> = [OperationInput<Value>] extends [undefined]
	? [onEvent: (event: SubscriptionEvent<Value>) => void, options?: SubscribeOptions]
	: [input: OperationInput<Value>, onEvent: (event: SubscriptionEvent<Value>) => void, options?: SubscribeOptions];
