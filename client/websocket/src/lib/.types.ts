import type { Protocol, Client as RealtimeClient } from "@serve-tools/client-realtime";

export type {
	Operation,
	OperationInput,
	Protocol,
	ProtocolDefinition,
	ProtocolResource,
	ProtocolType,
	RequestArguments,
	RequestName,
	RequestOperation,
	RequestOptions,
	RequestOutput,
	SubscribeArguments,
	SubscribeOptions,
	Subscription,
	SubscriptionEvent,
	SubscriptionName,
	SubscriptionOperation,
} from "@serve-tools/client-realtime";

/** Options for opening a WebSocket protocol client. */
export interface ConnectOptions {
	/** Aborts the opening handshake. */
	readonly signal?: AbortSignal;
}

/** A typed, disposable WebSocket protocol client. */
export interface Client<P extends Protocol = Protocol> extends RealtimeClient<P> {}
