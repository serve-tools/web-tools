/// <reference lib="dom" />
/// <reference lib="esnext.disposable" />

import type * as T from "../.types.js";
import { connect as connectPort } from "../connect.js";

export { RemoteError } from "@serve-tools/client-messaging";
export type * from "../.types.js";

/** Connects a typed page client to a worker-owned WebTransport session. */
export const connect = connectPort;

/** Types used by {@link connect}. */
export namespace connect {
	/** A typed page client for a worker-owned WebTransport session. */
	export type Client<P extends T.Protocol = T.Protocol> = T.SharedWebTransportClient<P>;

	/** Typed best-effort datagrams routed through the worker-owned session. */
	export type Datagrams<P extends T.Protocol> = T.SharedClientDatagrams<P>;

	/** A compile-time collection of reliable operations and datagram channels. */
	export type Protocol = T.Protocol;

	/** Extracts the protocol retained by a shared WebTransport client or server. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** Options for sending and cancelling a reliable request. */
	export type RequestOptions = T.RequestOptions;

	/** Options for cancelling or observing a reliable subscription. */
	export type SubscribeOptions = T.SubscribeOptions;

	/** A disposable handle for one active page-local subscription. */
	export type Subscription = T.Subscription;
}
