/// <reference lib="dom" />
/// <reference lib="esnext.disposable" />

import type * as T from "../.types.js";
import { connect as connectPort } from "../connect.js";

export { RemoteError } from "@serve-tools/client-messaging";
export type {
	Protocol,
	ProtocolType,
	RequestOptions,
	SharedWebSocketClient,
	SharedWebSocketServer,
	SubscribeOptions,
	Subscription,
} from "../.types.js";

/** Connects a typed client to the physical WebSocket owned by a shared worker. */
export const connect = connectPort;

/** Types used by {@link connect}. */
export namespace connect {
	/** A typed client whose physical WebSocket is owned by a `SharedWorker`. */
	export type Client<P extends T.Protocol = T.Protocol> = T.SharedWebSocketClient<P>;

	/** Extracts the protocol retained by a shared WebSocket resource. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** Options for sending and cancelling a request. */
	export type RequestOptions = T.RequestOptions;

	/** Options for sending, cancelling, and observing a subscription. */
	export type SubscribeOptions = T.SubscribeOptions;

	/** A disposable handle for one active subscription. */
	export type Subscription = T.Subscription;
}
