/// <reference lib="dom" />

import type { ProtocolDefinition } from "../lib/.types.js";
import type * as T from "../lib/types.js";

export type * from "../lib/types.js";

import { connect as connectPort } from "../lib/connect.js";

export * from "../lib/transfer.js";

/**
 * A platform `SharedWorker` with a typed protocol client connected to its port.
 *
 * The returned `SharedWorker` instance's `client` property is available as soon
 * as the worker is constructed.
 */
export class SharedWorker<
	const P extends T.Protocol & ProtocolDefinition<P> = Record<never, never>,
> extends globalThis.SharedWorker {
	/** The typed client connected to the worker's port. */
	readonly client: T.Client<P>;

	constructor(scriptURL: string | URL, options?: string | WorkerOptions) {
		super(scriptURL, options);

		this.client = connectPort<P>(this.port);
	}
}

/** Connects a typed protocol client to a worker or message port. */
export const connect = connectPort;

/** Protocol declarations available through {@link connect}. */
export namespace connect {
	/** An endpoint compatible with workers and message ports. */
	export type MessageEndpoint = T.MessageEndpoint;

	/** A typed, disposable connection used to request and subscribe to remote operations. */
	export type Client<P extends T.Protocol = T.Protocol> = T.Client<P>;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** Extracts the inline protocol retained by a client, server, or listener. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** Options for sending and cancelling a request. */
	export type RequestOptions = T.RequestOptions;

	/** Options for sending, cancelling, and observing the completion of a subscription. */
	export type SubscribeOptions = T.SubscribeOptions;

	/** A disposable handle for one active subscription. */
	export type Subscription = T.Subscription;
}
