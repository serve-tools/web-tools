/// <reference lib="dom" />

import type * as T from "../types.js";

export type * from "../types.js";

import { connect as connectPort } from "../connect.js";

export * from "../transfer.js";

/**
 * A platform `SharedWorker` with a typed protocol client connected to its port.
 *
 * The returned `SharedWorker` instance's `client` property is available as soon
 * as the worker is constructed.
 */
export class SharedWorker<P extends T.WorkerProtocol = T.WorkerProtocol> extends globalThis.SharedWorker {
	/** The typed client connected to the worker's port. */
	readonly client: T.WorkerClient<P> = connectPort<P>(this.port);
}

/** Connects a typed protocol client to a worker or message port. */
export const connect = connectPort;

/** Protocol declarations available through {@link connect}. */
export namespace connect {
	/** An endpoint compatible with workers and message ports. */
	export type MessageEndpoint = T.MessageEndpoint;

	/** Extracts the protocol retained by a server or worker-scope listener result. */
	export type ProtocolType<Value extends T.WorkerServer | readonly T.WorkerServer[]> = T.ProtocolType<Value>;

	/** A typed, disposable connection used to request and subscribe to remote operations. */
	export type WorkerClient<P extends T.WorkerProtocol> = T.WorkerClient<P>;

	/** Handler tables implementing every request and subscription in a protocol. */
	export type WorkerHandlers<P extends T.WorkerProtocol> = T.WorkerHandlers<P>;

	/** A disposable collection of the active protocol servers owned by a worker scope. */
	export type WorkerListener<P extends T.WorkerProtocol> = T.WorkerListener<P>;

	/** Describes one request or subscription operation. */
	export type WorkerOperation<Input, Output> = T.WorkerOperation<Input, Output>;

	/** A collection of named request and subscription operations. */
	export type WorkerProtocol = T.WorkerProtocol;

	/** State supplied to a request handler. */
	export type WorkerRequestContext = T.WorkerRequestContext;

	/** Options for sending and cancelling a request. */
	export type WorkerRequestOptions = T.WorkerRequestOptions;

	/** A disposable server attached to one message endpoint. */
	export type WorkerServer<P extends T.WorkerProtocol> = T.WorkerServer<P>;

	/** Options for sending, cancelling, and observing the completion of a subscription. */
	export type WorkerSubscribeOptions = T.WorkerSubscribeOptions;

	/** A disposable handle for one active subscription. */
	export type WorkerSubscription = T.WorkerSubscription;

	/** Controls event delivery and settlement from a subscription handler. */
	export type WorkerSubscriptionContext<Value> = T.WorkerSubscriptionContext<Value>;

	/** A result value paired with objects whose ownership should be transferred. */
	export type WorkerTransferResult<Value> = T.WorkerTransferResult<Value>;
}
