/// <reference lib="webworker" />

import type { ProtocolDefinition } from "../lib/.types.js";
import type * as T from "../lib/types.js";

export type * from "../lib/types.js";

import { serve } from "../lib/serve.js";

export * from "../lib/transfer.js";

/**
 * Listens for protocol messages in a dedicated or shared worker scope.
 *
 * The returned listener contains the active dedicated-worker server immediately
 * or each active shared-worker connection as it arrives, and retains the
 * declared protocol type.
 */
export const listen = <const P extends T.Protocol & ProtocolDefinition<P>>(handlers: T.Handlers<P>): T.Listener<P> => {
	const connections: T.Server<P>[] = [];
	const scope = globalThis as unknown as T.MessageEndpoint | SharedWorkerGlobalScope | DedicatedWorkerGlobalScope;
	let isClosed = false;

	const add = (endpoint: T.MessageEndpoint): void => {
		if (isClosed) return;

		const server = serve<P>(endpoint, handlers);

		connections.push(server);
		void server.closed.then(() => {
			const index = connections.indexOf(server);

			if (index !== -1) connections.splice(index, 1);
		});
	};

	const connected = ({ ports }: MessageEvent): void => {
		const port = ports[0];

		if (port) add(port);
	};

	if ("onconnect" in scope) {
		scope.addEventListener("connect", connected);
	} else if ("postMessage" in scope) {
		add(scope);
	} else {
		throw new TypeError("listen() requires a dedicated or shared worker scope");
	}

	const close = (reason?: unknown): void => {
		if (isClosed) return;

		isClosed = true;

		if ("onconnect" in scope) scope.removeEventListener("connect", connected);

		for (const server of [...connections]) server.close(reason);

		connections.length = 0;
	};

	return Object.defineProperties(connections, {
		close: { value: close },
		[Symbol.dispose]: { value: close },
	}) as unknown as T.Listener<P>;
};

/** Protocol declarations available through {@link listen}. */
export namespace listen {
	/** An endpoint compatible with workers and message ports. */
	export type MessageEndpoint = T.MessageEndpoint;

	/** Handler tables implementing every section declared by a protocol. */
	export type Handlers<P extends T.Protocol> = T.Handlers<P>;

	/** A disposable collection of the active protocol servers owned by a worker scope. */
	export type Listener<P extends T.Protocol = T.Protocol> = T.Listener<P>;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** Extracts the inline protocol retained by a client, server, or listener. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** State supplied to a request handler. */
	export type RequestContext = T.RequestContext;

	/** A disposable server attached to one message endpoint. */
	export type Server<P extends T.Protocol = T.Protocol> = T.Server<P>;

	/** Controls event delivery and settlement from a subscription handler. */
	export type SubscriptionContext<Value> = T.SubscriptionContext<Value>;

	/** A result value paired with objects whose ownership should be transferred. */
	export type TransferResult<Value> = T.TransferResult<Value>;
}
