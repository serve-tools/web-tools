/// <reference lib="dom" />
/// <reference lib="esnext.disposable" />

import type * as T from "../.types.js";
import { connect as connectPort } from "../connect.js";

export { RemoteError } from "@serve-tools/client-messaging";
export type * from "../.types.js";

/** Connects a page to HTTP exchanges coordinated by a shared worker. */
export const connect = connectPort;

/** Types used by {@link connect}. */
export namespace connect {
	/** A typed page client for HTTP exchanges owned by a shared worker. */
	export type Client<P extends T.Protocol = T.Protocol> = T.SharedHTTPStreamClient<P>;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** Extracts the protocol retained by a shared HTTP stream client or server. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** Options for sending and cancelling an HTTP request. */
	export type RequestOptions = T.RequestOptions;

	/** Options for cancelling or observing an HTTP stream subscription. */
	export type SubscribeOptions = T.SubscribeOptions;

	/** A disposable handle for one active HTTP stream subscription. */
	export type Subscription = T.Subscription;
}
