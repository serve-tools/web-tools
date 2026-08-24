import type { Awaitable, Connection, ConnectionOptions, Handlers } from "@serve-tools/server-realtime";

export type { Protocol, ProtocolDefinition, ProtocolType } from "@serve-tools/realtime-protocol";
export type * from "@serve-tools/server-realtime";

/** Authorization and protocol limits applied to incoming HTTP requests. */
export interface HandlerOptions<Context = undefined> extends ConnectionOptions {
	/** Establishes connection context or returns an HTTP response rejecting the request. */
	readonly authorize?: (request: Request) => Awaitable<Context | Response>;
}

/** A disposable Fetch handler for finite requests and streaming subscriptions. */
export interface FetchHandler extends Disposable {
	/** Handles one protocol request and returns its finite or streaming HTTP response. */
	(request: Request): Promise<Response>;

	/** Closes every active connection and rejects subsequent HTTP requests. */
	close(reason?: unknown): void;
}

export type { Awaitable, Connection, Handlers };
