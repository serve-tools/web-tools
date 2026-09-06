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

/** Validates the named request and subscription signatures accepted by a shared HTTP stream client. */
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

/** The request and subscription protocol exchanged between a page and its shared HTTP worker. */
export type SharedHTTPStreamBridgeProtocol = {
	/** Page requests forwarded to the worker-owned HTTP stream client. */
	requests: {
		/** Forwards one named HTTP request and its input to the shared worker. */
		request(input: SharedHTTPStreamOperation): unknown;
	};

	/** Page subscriptions forwarded to the worker-owned HTTP stream client. */
	subscriptions: {
		/** Forwards one named HTTP subscription and its input to the shared worker. */
		subscribe(input: SharedHTTPStreamOperation): unknown;
	};
};

/** A named HTTP operation forwarded between a page and its shared worker. */
export interface SharedHTTPStreamOperation {
	/** The application-defined request or subscription name. */
	readonly name: string;

	/** The structured-clone input supplied by the page client. */
	readonly input: unknown;
}
