import { Signal } from "@serve-tools/signal";
import { nothing } from "lit";
import { AsyncDirective } from "lit/async-directive.js";
import { enqueueMicrotask } from "../lib/scheduler.js";

/** A zero-argument callback whose signal reads determine its reactive value. */
export type ReactiveCallback<Value> = () => Value;

/** A signal or callback that supplies a reactive directive value. */
export type ReactiveSource<Value> = Signal.Any<Value> | ReactiveCallback<Value>;

/** Shared signal subscription lifecycle for reactive Lit directives. */
export abstract class ReactiveDirective<Value = unknown> extends AsyncDirective {
	#arguments: readonly unknown[] | undefined;
	#isPending = false;
	#signal: Signal.Any<Value> | undefined;

	readonly #watcher = new Signal.subtle.Watcher(() => {
		if (!this.#isPending) {
			this.#isPending = true;

			enqueueMicrotask(this);
		}
	});

	/** Applies the latest observed signal value during the shared microtask flush. */
	run(): void {
		this.#isPending = false;
		this.#watcher.watch();

		if (this.isConnected && this.#signal !== undefined) {
			this.setValue(this.#signal.get());
		}
	}

	/** Replaces the observed signal and returns its current untracked value. */
	protected observe(signal: Signal.Any<Value> | undefined): Value {
		if (signal !== this.#signal) {
			if (this.#signal !== undefined) {
				this.#watcher.unwatch(this.#signal);
			}

			this.#signal = signal;

			if (this.isConnected && signal !== undefined) {
				this.#watcher.watch(signal);
			}
		}

		return this.read();
	}

	/** Returns the current observed value without creating an outer signal dependency. */
	protected read(): Value {
		return this.#signal === undefined ? (nothing as Value) : Signal.subtle.untrack(() => this.#signal!.get());
	}

	/** Reuses the current computation unless the directive arguments change. */
	protected observeArguments(arguments_: readonly unknown[], compute: () => Value): Value {
		if (
			this.#arguments === undefined ||
			this.#arguments.length !== arguments_.length ||
			!this.#arguments.every((value, index) => value === arguments_[index])
		) {
			this.#arguments = arguments_;

			return this.observe(new Signal.Computed(compute));
		}

		return this.read();
	}

	/** Stops observing its signal while the directive is disconnected. */
	disconnected(): void {
		if (this.#signal !== undefined) {
			this.#watcher.unwatch(this.#signal);
		}
	}

	/** Resumes observation and refreshes the directive after reconnection. */
	reconnected(): void {
		if (this.#signal !== undefined) {
			this.#watcher.watch(this.#signal);

			this.setValue(this.read());
		}
	}
}

/** Reads either a signal or a zero-argument reactive callback. */
export const readSource = <Value>(source: ReactiveSource<Value>): Value => {
	return typeof source === "function" ? source() : source.get();
};
