import type { Awaitable, Connection, ConnectionOptions, Handlers } from "@serve-tools/server-realtime";

export type { Protocol, ProtocolDefinition, ProtocolType } from "@serve-tools/realtime-protocol";
export type * from "@serve-tools/server-realtime";

export interface HandlerOptions<Context = undefined> extends ConnectionOptions {
	readonly authorize?: (request: Request) => Awaitable<Context | Response>;
}

export interface FetchHandler extends Disposable {
	(request: Request): Promise<Response>;
	close(reason?: unknown): void;
}

export type { Awaitable, Connection, Handlers };
