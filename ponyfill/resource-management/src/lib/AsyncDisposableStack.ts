import { chk, getMethod, State, throwErrors } from "./.internals.js";
import type { AsyncDisposable } from "./AsyncDisposable.js";
import type { Disposable } from "./Disposable.js";
import { asyncDispose } from "./Symbol/asyncDispose.js";
import { dispose } from "./Symbol/dispose.js";

/**
 * A stack-based container of asynchronously disposable resources.
 * Resources are disposed in reverse order when the stack is disposed.
 */
export class AsyncDisposableStack {
	#state: State = State.Pending;
	#stack: Array<() => void | PromiseLike<void>> = [];

	/** Whether this stack has been disposed or moved. */
	get disposed() {
		return this.#state === State.Disposed;
	}

	/** Registers a disposable resource and returns it unchanged. `null` and `undefined` are ignored. */
	use<T extends AsyncDisposable | Disposable | null | undefined>(value: T): T {
		chk(this.#state);

		if (value != null) {
			const method = getMethod<void | PromiseLike<void>>(value, asyncDispose) ?? getMethod<void>(value, dispose);
			if (!method) throw new TypeError("Object is not disposable");
			this.#stack.push(method);
		}

		return value;
	}

	/** Registers a callback that asynchronously disposes `value`, then returns `value` unchanged. */
	adopt<T>(value: T, onDisposeAsync: (value: T) => void | PromiseLike<void>): T {
		chk(this.#state);

		this.#stack.push(() => onDisposeAsync(value));

		return value;
	}

	/** Registers a callback to run during asynchronous disposal. */
	defer(onDisposeAsync: () => void | PromiseLike<void>): void {
		chk(this.#state);

		this.#stack.push(onDisposeAsync);
	}

	/** Moves the registered resources into a new stack and marks this stack as disposed. */
	move(): AsyncDisposableStack {
		chk(this.#state);

		const n = new AsyncDisposableStack();

		n.#stack = this.#stack;

		this.#stack = [];
		this.#state = State.Disposed;

		return n;
	}

	/** Asynchronously disposes resources in reverse order and combines multiple failures with `SuppressedError`. */
	async disposeAsync(): Promise<void> {
		if (this.#state === State.Disposed) return;

		this.#state = State.Disposed;

		const errors: unknown[] = [];

		while (this.#stack.length) {
			try {
				await this.#stack.pop()!();
			} catch (e) {
				errors.push(e);
			}
		}
		throwErrors(errors);
	}

	/** Disposes the stack through this package's asynchronous disposal protocol. */
	async [asyncDispose]() {
		await this.disposeAsync();
	}

	/** The built-in tag used by `Object.prototype.toString`. */
	get [Symbol.toStringTag]() {
		return "AsyncDisposableStack";
	}
}
