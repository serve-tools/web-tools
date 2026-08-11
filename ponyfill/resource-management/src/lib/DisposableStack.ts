import { chk, getMethod, State, throwErrors } from "./.internals.js";
import type { Disposable } from "./Disposable.js";
import { dispose } from "./Symbol/dispose.js";

/**
 * A stack-based container of disposable resources.
 * Resources are disposed in reverse order when the stack is disposed.
 */
export class DisposableStack {
	#state: State = State.Pending;
	#stack: Array<() => void> = [];

	/** Whether this stack has been disposed or moved. */
	get disposed() {
		return this.#state === State.Disposed;
	}

	/** Registers a disposable resource and returns it unchanged. `null` and `undefined` are ignored. */
	use<T extends Disposable | null | undefined>(value: T): T {
		chk(this.#state);

		if (value != null) {
			const method = getMethod<void>(value, dispose);
			if (!method) throw new TypeError("Object is not disposable");
			this.#stack.push(method);
		}

		return value;
	}

	/** Registers a callback that disposes `value`, then returns `value` unchanged. */
	adopt<T>(value: T, onDispose: (value: T) => void): T {
		chk(this.#state);

		this.#stack.push(() => onDispose(value));

		return value;
	}

	/** Registers a callback to run during disposal. */
	defer(onDispose: () => void): void {
		chk(this.#state);

		this.#stack.push(onDispose);
	}

	/** Moves the registered resources into a new stack and marks this stack as disposed. */
	move(): DisposableStack {
		chk(this.#state);

		const n = new DisposableStack();

		n.#stack = this.#stack;

		this.#stack = [];
		this.#state = State.Disposed;

		return n;
	}

	/** Disposes registered resources in reverse order and combines multiple failures with `SuppressedError`. */
	dispose(): void {
		if (this.#state === State.Disposed) return;

		this.#state = State.Disposed;

		const errors: unknown[] = [];

		while (this.#stack.length) {
			try {
				this.#stack.pop()!();
			} catch (e) {
				errors.push(e);
			}
		}

		throwErrors(errors);
	}

	/** Disposes the stack through this package's disposal protocol. */
	[dispose]() {
		this.dispose();
	}

	/** The built-in tag used by `Object.prototype.toString`. */
	get [Symbol.toStringTag]() {
		return "DisposableStack";
	}
}
