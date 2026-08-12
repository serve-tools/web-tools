import { assertPending, disposeResourcesAsync, getDisposeMethod, StackState } from "./.internals.js";
import type { AsyncDisposable } from "./AsyncDisposable.js";
import type { Disposable } from "./Disposable.js";
import { asyncDispose } from "./Symbol/asyncDispose.js";
import { dispose } from "./Symbol/dispose.js";

/**
 * A stack-based container of asynchronously disposable resources.
 * Resources are disposed in reverse order when the stack is disposed.
 */
export class AsyncDisposableStack {
	#state: StackState = StackState.Pending;
	#disposers: Array<() => void | PromiseLike<void>> = [];

	/** Whether this stack has been disposed or moved. */
	get disposed(): boolean {
		return this.#state === StackState.Disposed;
	}

	/** Registers a disposable resource and returns it unchanged. `null` and `undefined` are ignored. */
	use<T extends AsyncDisposable | Disposable | null | undefined>(value: T): T {
		assertPending(this.#state);

		if (value != null) {
			const method =
				getDisposeMethod<void | PromiseLike<void>>(value, asyncDispose) ??
				getDisposeMethod<void>(value, dispose);
			if (!method) throw new TypeError("Object is not disposable");
			this.#disposers.push(method);
		}

		return value;
	}

	/** Registers a callback that asynchronously disposes `value`, then returns `value` unchanged. */
	adopt<T>(value: T, onDisposeAsync: (value: T) => void | PromiseLike<void>): T {
		assertPending(this.#state);

		this.#disposers.push(() => onDisposeAsync(value));

		return value;
	}

	/** Registers a callback to run during asynchronous disposal. */
	defer(onDisposeAsync: () => void | PromiseLike<void>): void {
		assertPending(this.#state);

		this.#disposers.push(onDisposeAsync);
	}

	/** Moves the registered resources into a new stack and marks this stack as disposed. */
	move(): AsyncDisposableStack {
		assertPending(this.#state);

		const movedStack = new AsyncDisposableStack();

		movedStack.#disposers = this.#disposers;

		this.#disposers = [];
		this.#state = StackState.Disposed;

		return movedStack;
	}

	/** Asynchronously disposes resources in reverse order and combines multiple failures with `SuppressedError`. */
	async disposeAsync(): Promise<void> {
		if (this.#state === StackState.Disposed) return;

		this.#state = StackState.Disposed;
		await disposeResourcesAsync(this.#disposers);
	}

	/** Disposes the stack through this package's asynchronous disposal protocol. */
	async [asyncDispose](): Promise<void> {
		await this.disposeAsync();
	}

	/** The built-in tag used by `Object.prototype.toString`. */
	get [Symbol.toStringTag](): string {
		return "AsyncDisposableStack";
	}
}
