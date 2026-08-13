import { Signal } from "@serve-tools/signal";
import { nothing } from "lit";
import { AsyncDirective } from "lit/async-directive.js";
import type { DirectiveResult } from "lit/directive.js";
import { directive } from "lit/directive.js";
import { enqueueMicrotask } from "../lib/scheduler.js";

/** A callback whose signal reads determine when its Lit part updates. */
export type WatchCallback<Value> = () => Value;

/** A signal or reactive callback rendered by `watch()`. */
export type WatchSource<Value> = Signal.Any<Value> | WatchCallback<Value>;

class WatchDirective<T = unknown> extends AsyncDirective {
	#isPending = false;
	#source: WatchSource<T> | undefined;
	#signal: Signal.Any<T> | undefined;

	readonly #watcher = new Signal.subtle.Watcher(() => {
		if (!this.#isPending) {
			this.#isPending = true;

			enqueueMicrotask(this);
		}
	});

	run(): void {
		this.#isPending = false;
		this.#watcher.watch();

		if (this.isConnected && this.#signal !== undefined) {
			this.setValue(this.#signal.get());
		}
	}

	render(source: WatchSource<T> | undefined): unknown {
		if (source === undefined) {
			return nothing;
		}

		const signal = typeof source === "function" ? new Signal.Computed(source) : source;

		return signal.get() ?? nothing;
	}

	update(_part: unknown, [source]: [WatchSource<T> | undefined]): T {
		if (source !== this.#source) {
			if (this.#signal !== undefined) {
				this.#watcher.unwatch(this.#signal);
			}

			this.#source = source;
			this.#signal = typeof source === "function" ? new Signal.Computed(source) : source;

			if (this.isConnected && this.#signal !== undefined) {
				this.#watcher.watch(this.#signal);
			}
		}

		return this.#signal?.get() ?? (nothing as T);
	}

	disconnected(): void {
		if (this.#signal !== undefined) {
			this.#watcher.unwatch(this.#signal);
		}
	}

	reconnected(): void {
		if (this.#signal !== undefined) {
			this.#watcher.watch(this.#signal);

			this.setValue(this.#signal.get());
		}
	}
}

/** Renders a signal or reactive callback and updates its Lit part when its signals change. */
export const watch = directive(WatchDirective) as {
	<Value>(signal?: Signal.Any<Value>): DirectiveResult<typeof WatchDirective<Value>>;
	<Value>(callback: WatchCallback<Value>): DirectiveResult<typeof WatchDirective<Value>>;
	<Value>(source: WatchSource<Value>): DirectiveResult<typeof WatchDirective<Value>>;
};
