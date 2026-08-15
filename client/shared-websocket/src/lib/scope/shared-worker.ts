/// <reference lib="esnext.disposable" />
/// <reference lib="webworker" />

import type * as T from "../.types.js";
import { listen as listenForWebSocket } from "../listen.js";

export type {
	ConnectOptions,
	Protocol,
	ProtocolType,
	RequestOptions,
	SharedWebSocketClient,
	SharedWebSocketServer,
	SubscribeOptions,
	Subscription,
} from "../.types.js";

/** Opens one physical WebSocket and serves it to every port connected to this shared worker. */
export const listen = listenForWebSocket;

/** Types used by {@link listen}. */
export namespace listen {
	/** Options for opening the physical WebSocket. */
	export type Options = T.ConnectOptions;

	/** Extracts the protocol retained by a shared WebSocket resource. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** A worker-owned physical WebSocket and its attached page connections. */
	export type Server<P extends T.Protocol = T.Protocol> = T.SharedWebSocketServer<P>;
}
