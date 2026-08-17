/// <reference lib="esnext.disposable" />

/** Represents a value represented without loss by JSON. */
export type JSONValue = null | boolean | number | string | readonly JSONValue[] | { readonly [key: string]: JSONValue };

/** Represents a compile-time map from Server-Sent Event names to JSON values. */
export type EventMap = object;

/** Represents a verified event map where every value is recursively JSON-compatible. */
export type EventMapDefinition<Events> = {
	readonly [Name in keyof Events]: Events[Name] extends JSONDefinition<Events[Name]> ? Events[Name] : never;
};

/** Represents a synchronous or asynchronous value. */
export type Awaitable<Value> = Value | PromiseLike<Value>;

/** Represents the optional cleanup returned after one event stream connects. */
export type ConnectionResult = undefined | (() => void);

/** Represents the optional spec fields attached to one Server-Sent Event. */
export interface SendOptions {
	/** Sets the event ID used as `Last-Event-ID` when EventSource reconnects. */
	readonly id?: string;
}

/** Represents one open Server-Sent Events response. */
export interface EventConnection<Events extends EventMap = EventMap, Context = undefined> extends Disposable {
	/** Application state established while accepting this connection. */
	readonly context: Context;

	/** The request that opened this connection. */
	readonly request: Request;

	/** Aborts when the connection closes. */
	readonly signal: AbortSignal;

	/** The last event ID received by this connection. */
	readonly lastEventId: string;

	/** Sends one event to this connection. */
	send<Name extends Extract<keyof Events, string>>(
		name: Name,
		data: Extract<Events[Name], JSONValue>,
		options?: SendOptions,
	): void;

	/** Sends a comment to this connection. */
	comment(value?: string): void;

	/** Sends a retry hint to this connection. */
	retry(milliseconds: number): void;

	/** Closes this connection. */
	close(): void;
}

/** Represents the configuration for a Fetch-compatible Server-Sent Events handler. */
export interface HandlerOptions<Events extends EventMap = EventMap, Context = undefined> {
	/** Authorizes one EventSource connection request. */
	readonly authorize?: (request: Request) => Awaitable<Context | Response>;

	/** Handles one EventSource connection request. */
	readonly connect?: (connection: EventConnection<Events, Context>) => Awaitable<ConnectionResult>;
}

/** Represents a fetch handler that broadcasts typed JSON events to its open connections. */
export interface EventSourceHandler<Events extends EventMap = EventMap> extends Disposable {
	/** Handles one EventSource connection request. */
	(request: Request): Promise<Response>;

	/** The number of open connections. */
	readonly size: number;

	/** Sends an event to every open connection. */
	send<Name extends Extract<keyof Events, string>>(
		name: Name,
		data: Extract<Events[Name], JSONValue>,
		options?: SendOptions,
	): void;

	/** Sends a comment to every open connection. */
	comment(value?: string): void;

	/** Sends a retry hint to every open connection. */
	retry(milliseconds: number): void;

	/** Closes every open connection. */
	close(): void;
}

/** Represents the extracted event map retained by an EventSource handler or connection. */
export type EventMapType<Value> =
	Value extends EventSourceHandler<infer Events>
		? Events
		: Value extends EventConnection<infer Events, unknown>
			? Events
			: never;

/** Represents a JSON-compatible primitive value. */
type JSONPrimitive = null | boolean | number | string;

/** Represents a value that is recursively JSON-compatible. */
type JSONDefinition<Value> = Value extends JSONPrimitive
	? Value
	: Value extends (...arguments_: any[]) => unknown
		? never
		: Value extends readonly (infer Item)[]
			? readonly JSONDefinition<Item>[]
			: Value extends object
				? { readonly [Key in keyof Value]: JSONDefinition<Value[Key]> }
				: never;
