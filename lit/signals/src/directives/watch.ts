import { Signal } from "@serve-tools/signal";
import { nothing } from "lit";
import type { DirectiveResult } from "lit/directive.js";
import { directive } from "lit/directive.js";
import type { ReactiveSource } from "./.internals.js";
import { ReactiveDirective } from "./.internals.js";

/** A callback whose signal reads determine when its Lit part updates. */
export type WatchCallback<Value> = () => Value;

/** A signal or reactive callback rendered by `watch()`. */
export type WatchSource<Value> = ReactiveSource<Value>;

class WatchDirective<T = unknown> extends ReactiveDirective<T> {
	#source: WatchSource<T> | undefined;

	render(source: WatchSource<T> | undefined): unknown {
		if (source === undefined) {
			return nothing;
		}

		const signal = typeof source === "function" ? new Signal.Computed(source) : source;

		return signal.get() ?? nothing;
	}

	update(_part: unknown, [source]: [WatchSource<T> | undefined]): T {
		if (source !== this.#source) {
			this.#source = source;

			return this.observe(typeof source === "function" ? new Signal.Computed(source) : source);
		}

		return this.read();
	}
}

/** Renders a signal or reactive callback and updates its Lit part when its signals change. */
export const watch = directive(WatchDirective) as {
	<Value>(signal?: Signal.Any<Value>): DirectiveResult<typeof WatchDirective<Value>>;
	<Value>(callback: WatchCallback<Value>): DirectiveResult<typeof WatchDirective<Value>>;
	<Value>(source: WatchSource<Value>): DirectiveResult<typeof WatchDirective<Value>>;
};
