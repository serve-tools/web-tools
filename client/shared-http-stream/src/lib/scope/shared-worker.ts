/// <reference lib="esnext.disposable" />
/// <reference lib="webworker" />

import type * as T from "../.types.js";
import { listen as listenForHTTPStream } from "../listen.js";

export type * from "../.types.js";

/** Serves one worker-owned HTTP stream client to every connected page. */
export const listen = listenForHTTPStream;

export namespace listen {
	export type Options = T.ConnectOptions;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type Server<P extends T.Protocol = T.Protocol> = T.SharedHTTPStreamServer<P>;
}
