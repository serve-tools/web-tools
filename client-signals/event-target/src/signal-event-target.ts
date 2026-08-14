/// <reference lib="esnext.disposable" preserve="true" />

import { Signal } from "@serve-tools/signal";

/** Configuration for an event-target-backed Signal. */
export interface EventTargetSignalOptions<Value> {
	/** Returns whether two values should be treated as equal. Defaults to `Object.is`. */
	readonly equals?: (a: Value, b: Value) => boolean;

	/** Stops observation when aborted without transferring ownership of the controller. */
	readonly signal?: AbortSignal;
}

/** Read-only Signal state kept current by one event type from an EventTarget. */
export class EventTargetSignal<Value> extends Signal.Computed<Value> implements Disposable {
	readonly #abortSignal: AbortSignal | undefined;
	readonly #read: () => Value;
	readonly #state: Signal.State<Value>;
	readonly #update: EventListener;

	#active: boolean;

	/** The event target being observed. */
	readonly target: EventTarget;

	/** The event type that triggers a value refresh. */
	readonly type: string;

	/**
	 * Creates an eager observation with an initial synchronous read.
	 * The returned Signal may coalesce event occurrences that produce equal values.
	 */
	constructor(target: EventTarget, type: string, read: () => Value, options?: EventTargetSignalOptions<Value>) {
		const state = new Signal.State(read(), options?.equals === undefined ? undefined : { equals: options.equals });

		super(() => state.get());

		this.#abortSignal = options?.signal;
		this.#read = read;
		this.#state = state;
		this.#update = () => this.refresh();
		this.#active = options?.signal?.aborted !== true;
		this.target = target;
		this.type = type;

		if (!this.#active) return;

		this.#abortSignal?.addEventListener("abort", this.#abort, { once: true });

		if (this.#abortSignal?.aborted === true) {
			this.dispose();

			return;
		}

		try {
			target.addEventListener(type, this.#update);
		} catch (error) {
			this.dispose();

			throw error;
		}
	}

	/** Whether this Signal is still observing its target. */
	get active(): boolean {
		return this.#active;
	}

	/** Rereads the current value synchronously while observation is active. */
	refresh(): void {
		if (this.#active) this.#state.set(this.#read());
	}

	/** Stops observation once and freezes the last value. */
	dispose(): void {
		if (!this.#active) return;

		this.#active = false;
		this.target.removeEventListener(this.type, this.#update);
		this.#abortSignal?.removeEventListener("abort", this.#abort);
	}

	[Symbol.dispose](): void {
		this.dispose();
	}

	readonly #abort = (): void => this.dispose();
}

/** Read-only Signal state containing whether one media query currently matches. */
export class MatchMediaSignal<const Query extends string = string> extends EventTargetSignal<boolean> {
	declare readonly target: MediaQueryList;

	/** The exact media query passed to `matchMedia()`. */
	readonly query: Query;

	constructor(query: Query, options?: EventTargetSignalOptions<boolean>) {
		const target = matchMedia(query);

		super(target, "change", () => target.matches, options);

		this.query = query;
	}
}
