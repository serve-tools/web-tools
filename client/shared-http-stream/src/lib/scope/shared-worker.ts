/// <reference lib="esnext.disposable" />
/// <reference lib="webworker" />

import type * as T from "../.types.js";
import { listen as listenForHTTPStream } from "../listen.js";

export type * from "../.types.js";

/** Serves one worker-owned HTTP stream client to every connected page. */
export const listen = listenForHTTPStream;

/** Types used by {@link listen}. */
export namespace listen {
	/** Options for opening the worker-owned HTTP stream client. */
	export type Options = T.ConnectOptions;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** Extracts the protocol retained by a shared HTTP stream client or server. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** A worker-owned HTTP stream client and its attached page connections. */
	export type Server<P extends T.Protocol = T.Protocol> = T.SharedHTTPStreamServer<P>;
}
