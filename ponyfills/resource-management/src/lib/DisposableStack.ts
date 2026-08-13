import { assertPending, disposeResources, getDisposeMethod, StackState } from "./.internals.js";
import type { Disposable } from "./Disposable.js";
import { dispose } from "./Symbol/dispose.js";

/**
 * A stack-based container of disposable resources.
 * Resources are disposed in reverse order when the stack is disposed.
 */
export class DisposableStack {
	#state: StackState = StackState.Pending;
	#disposers: Array<() => void> = [];

	/** Whether this stack has been disposed or moved. */
	get disposed(): boolean {
		return this.#state === StackState.Disposed;
	}

	/** Registers a disposable resource and returns it unchanged. `null` and `undefined` are ignored. */
	use<T extends Disposable | null | undefined>(value: T): T {
		assertPending(this.#state);

		if (value != null) {
			const method = getDisposeMethod<void>(value, dispose);

			if (!method) throw new TypeError("Object is not disposable");

			this.#disposers.push(method);
		}

		return value;
	}

	/** Registers a callback that disposes `value`, then returns `value` unchanged. */
	adopt<T>(value: T, onDispose: (value: T) => void): T {
		assertPending(this.#state);

		this.#disposers.push(() => onDispose(value));

		return value;
	}

	/** Registers a callback to run during disposal. */
	defer(onDispose: () => void): void {
		assertPending(this.#state);

		this.#disposers.push(onDispose);
	}

	/** Moves the registered resources into a new stack and marks this stack as disposed. */
	move(): DisposableStack {
		assertPending(this.#state);

		const movedStack = new DisposableStack();

		movedStack.#disposers = this.#disposers;

		this.#disposers = [];
		this.#state = StackState.Disposed;

		return movedStack;
	}

	/** Disposes registered resources in reverse order and combines multiple failures with `SuppressedError`. */
	dispose(): void {
		if (this.#state === StackState.Disposed) return;

		this.#state = StackState.Disposed;
		disposeResources(this.#disposers);
	}

	/** Disposes the stack through this package's disposal protocol. */
	[dispose](): void {
		this.dispose();
	}

	/** The built-in tag used by `Object.prototype.toString`. */
	get [Symbol.toStringTag](): string {
		return "DisposableStack";
	}
}
