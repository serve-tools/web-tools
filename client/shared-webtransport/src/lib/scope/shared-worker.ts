/// <reference lib="esnext.disposable" />
/// <reference lib="webworker" />

import type * as T from "../.types.js";
import { listen as listenForWebTransport } from "../listen.js";

export type * from "../.types.js";

/** Opens one worker-owned WebTransport session shared by every connected page. */
export const listen = listenForWebTransport;

/** Types used by {@link listen}. */
export namespace listen {
	/** Options for opening the worker-owned WebTransport session. */
	export type Options = T.ConnectOptions;

	/** A compile-time collection of reliable operations and datagram channels. */
	export type Protocol = T.Protocol;

	/** Extracts the protocol retained by a shared WebTransport client or server. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** A worker-owned WebTransport session and its attached page connections. */
	export type Server<P extends T.Protocol = T.Protocol> = T.SharedWebTransportServer<P>;
}
