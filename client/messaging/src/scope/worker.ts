/// <reference lib="webworker" />

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
export const listen = <const P extends T.WorkerProtocol>(handlers: T.WorkerHandlers<P>): T.WorkerListener<P> => {
	const connections: T.WorkerServer<P>[] = [];
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
	}) as unknown as T.WorkerListener<P>;
};

export namespace listen {
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
