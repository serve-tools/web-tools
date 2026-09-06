/// <reference lib="esnext.disposable" />

import type {
	ConnectOptions,
	Protocol,
	RequestOptions,
	SubscribeOptions,
	Subscription,
	Client as WebSocketClient,
	ProtocolType as WebSocketProtocolType,
} from "@serve-tools/client-websocket";

declare const serverBrand: unique symbol;

export type { ConnectOptions, Protocol, RequestOptions, SubscribeOptions, Subscription };

/** A typed WebSocket protocol client whose physical connection is owned by a `SharedWorker`. */
export interface SharedWebSocketClient<P extends Protocol = Protocol> extends WebSocketClient<P> {
	/** Resolves after either side closes this page's worker protocol connection. */
	readonly closed: Promise<void>;

	/** Closes this page's protocol connection without closing the shared physical WebSocket. */
	close(reason?: unknown): void;
}

/** Owns one physical WebSocket and every page protocol server attached to the current `SharedWorker`. */
export interface SharedWebSocketServer<P extends Protocol = Protocol> extends Disposable {
	readonly [serverBrand]?: P;

	/** The physical WebSocket protocol client opened and owned by this worker server. */
	readonly websocket: Promise<WebSocketClient<P>>;

	/** Resolves after the worker server and physical WebSocket close. */
	readonly closed: Promise<void>;

	/** Stops accepting ports and closes the physical WebSocket. */
	close(reason?: unknown): void;
}

/** Extracts the protocol retained by a shared client, server, or pending resource. */
export type ProtocolType<Value> =
	| WebSocketProtocolType<Value>
	| (Awaited<Value> extends SharedWebSocketServer<infer P> ? P : never);

export type ProtocolDefinition<P> = {
	readonly [Section in keyof P]: Section extends "requests" | "subscriptions"
		? P[Section] extends object
			? OperationDefinitions<P[Section]>
			: never
		: never;
};

type OperationDefinitions<Operations> = {
	readonly [Name in keyof Operations]: Operations[Name] extends (...arguments_: infer Arguments) => infer Output
		? Arguments extends [] | [unknown]
			? (...arguments_: Arguments) => Output
			: never
		: never;
};

export type SharedWebSocketBridgeProtocol = {
	requests: {
		request(input: SharedWebSocketOperation): unknown;
	};
	subscriptions: {
		subscribe(input: SharedWebSocketOperation): unknown;
	};
};

export interface SharedWebSocketOperation {
	readonly name: string;
	readonly input: unknown;
}
