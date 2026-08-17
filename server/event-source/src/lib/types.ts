/// <reference lib="esnext.disposable" />

/** A value represented without loss by JSON. */
export type JSONValue = null | boolean | number | string | readonly JSONValue[] | { readonly [key: string]: JSONValue };

/** A compile-time map from Server-Sent Event names to JSON values. */
export type EventMap = object;

/** Verifies that every event value is recursively JSON-compatible. */
export type EventMapDefinition<Events> = {
	readonly [Name in keyof Events]: Events[Name] extends JSONDefinition<Events[Name]> ? Events[Name] : never;
};

/** A synchronous or asynchronous value. */
export type Awaitable<Value> = Value | PromiseLike<Value>;

/** Optional cleanup returned after one event stream connects. */
export type ConnectionResult = undefined | (() => void);

/** Optional spec fields attached to one Server-Sent Event. */
export interface SendOptions {
	/** Sets the event ID used as `Last-Event-ID` when EventSource reconnects. */
	readonly id?: string;
}

/** One open Server-Sent Events response. */
export interface EventConnection<Events extends EventMap = EventMap, Context = undefined> extends Disposable {
	readonly context: Context;
	readonly request: Request;
	readonly signal: AbortSignal;
	readonly lastEventId: string;
	send<Name extends Extract<keyof Events, string>>(
		name: Name,
		data: Extract<Events[Name], JSONValue>,
		options?: SendOptions,
	): void;
	comment(value?: string): void;
	retry(milliseconds: number): void;
	close(): void;
}

/** Configuration for a Fetch-compatible Server-Sent Events handler. */
export interface HandlerOptions<Events extends EventMap = EventMap, Context = undefined> {
	readonly authorize?: (request: Request) => Awaitable<Context | Response>;
	readonly connect?: (connection: EventConnection<Events, Context>) => Awaitable<ConnectionResult>;
}

/** A Fetch handler that broadcasts typed JSON events to its open connections. */
export interface EventSourceHandler<Events extends EventMap = EventMap> extends Disposable {
	(request: Request): Promise<Response>;
	readonly size: number;
	send<Name extends Extract<keyof Events, string>>(
		name: Name,
		data: Extract<Events[Name], JSONValue>,
		options?: SendOptions,
	): void;
	comment(value?: string): void;
	retry(milliseconds: number): void;
	close(): void;
}

/** Extracts the event map retained by an EventSource handler or connection. */
export type EventMapType<Value> =
	Value extends EventSourceHandler<infer Events>
		? Events
		: Value extends EventConnection<infer Events, unknown>
			? Events
			: never;

type JSONPrimitive = null | boolean | number | string;
type JSONDefinition<Value> = Value extends JSONPrimitive
	? Value
	: Value extends (...arguments_: any[]) => unknown
		? never
		: Value extends readonly (infer Item)[]
			? readonly JSONDefinition<Item>[]
			: Value extends object
				? { readonly [Key in keyof Value]: JSONDefinition<Value[Key]> }
				: never;
