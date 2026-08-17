/// <reference lib="esnext.disposable" />

import type {
	ConnectOptions,
	Client as HTTPStreamClient,
	ProtocolType as HTTPStreamProtocolType,
	Protocol,
	RequestOptions,
	SubscribeOptions,
	Subscription,
} from "@serve-tools/client-http-stream";

declare const serverBrand: unique symbol;

export type { ConnectOptions, Protocol, RequestOptions, SubscribeOptions, Subscription };

/** A typed HTTP stream client whose Fetch exchanges are coordinated by a `SharedWorker`. */
export interface SharedHTTPStreamClient<P extends Protocol = Protocol> extends HTTPStreamClient<P> {
	/** Resolves after either side closes this page's worker protocol connection. */
	readonly closed: Promise<void>;

	/** Closes this page's protocol connection without closing the worker-owned HTTP client. */
	close(reason?: unknown): void;
}

/** Owns one HTTP stream client and every page protocol server attached to the current `SharedWorker`. */
export interface SharedHTTPStreamServer<P extends Protocol = Protocol> extends Disposable {
	readonly [serverBrand]?: P;

	/** The HTTP stream client opened and owned by this worker server. */
	readonly httpStream: HTTPStreamClient<P>;

	/** Resolves after the worker server and HTTP client close. */
	readonly closed: Promise<void>;

	/** Stops accepting ports and closes the worker-owned HTTP client. */
	close(reason?: unknown): void;
}

/** Extracts the protocol retained by a shared client or server. */
export type ProtocolType<Value> =
	| HTTPStreamProtocolType<Value>
	| (Awaited<Value> extends SharedHTTPStreamServer<infer P> ? P : never);

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

export type SharedHTTPStreamBridgeProtocol = {
	requests: { request(input: SharedHTTPStreamOperation): unknown };
	subscriptions: { subscribe(input: SharedHTTPStreamOperation): unknown };
};

export interface SharedHTTPStreamOperation {
	readonly name: string;
	readonly input: unknown;
}
