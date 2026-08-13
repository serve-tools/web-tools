type SuppressedErrorConstructor = new (error: unknown, suppressed: unknown, message?: string) => Error;

/** The public instance contract of the selected synchronous stack implementation. */
type DisposableStackInstance<Dispose extends symbol> = {
	/** Whether this stack has been disposed or moved. */
	readonly disposed: boolean;

	/** Registers a disposable resource and returns it unchanged. */
	use<T extends Record<Dispose, () => void> | null | undefined>(value: T): T;

	/** Registers a callback that disposes `value`, then returns `value` unchanged. */
	adopt<T>(value: T, onDispose: (value: T) => void): T;

	/** Registers a callback to run during disposal. */
	defer(onDispose: () => void): void;

	/** Moves the registered resources into a new stack and marks this stack as disposed. */
	move(): DisposableStackInstance<Dispose>;

	/** Disposes registered resources in reverse order. */
	dispose(): void;

	/** The built-in tag used by `Object.prototype.toString`. */
	readonly [Symbol.toStringTag]: string;
} & Record<Dispose, () => void>;

/** A constructor for the selected synchronous disposable-stack implementation. */
export type DisposableStackConstructor<Dispose extends symbol> = {
	/** Creates an empty disposable stack. */
	new (): DisposableStackInstance<Dispose>;

	/** The methods shared by disposable-stack instances. */
	readonly prototype: DisposableStackInstance<Dispose>;
};

/** The public instance contract of the selected asynchronous stack implementation. */
type AsyncDisposableStackInstance<AsyncDispose extends symbol, Dispose extends symbol> = {
	/** Whether this stack has been disposed or moved. */
	readonly disposed: boolean;

	/** Registers an asynchronous or synchronous disposable resource and returns it unchanged. */
	use<T extends Record<AsyncDispose, () => PromiseLike<void>> | Record<Dispose, () => void> | null | undefined>(
		value: T,
	): T;

	/** Registers a callback that asynchronously disposes `value`, then returns `value` unchanged. */
	adopt<T>(value: T, onDisposeAsync: (value: T) => void | PromiseLike<void>): T;

	/** Registers a callback to run during asynchronous disposal. */
	defer(onDisposeAsync: () => void | PromiseLike<void>): void;

	/** Moves the registered resources into a new stack and marks this stack as disposed. */
	move(): AsyncDisposableStackInstance<AsyncDispose, Dispose>;

	/** Asynchronously disposes registered resources in reverse order. */
	disposeAsync(): Promise<void>;

	/** The built-in tag used by `Object.prototype.toString`. */
	readonly [Symbol.toStringTag]: string;
} & Record<AsyncDispose, () => Promise<void>>;

/** A constructor for the selected asynchronous disposable-stack implementation. */
export type AsyncDisposableStackConstructor<AsyncDispose extends symbol, Dispose extends symbol> = {
	/** Creates an empty asynchronous disposable stack. */
	new (): AsyncDisposableStackInstance<AsyncDispose, Dispose>;

	/** The methods shared by asynchronous disposable-stack instances. */
	readonly prototype: AsyncDisposableStackInstance<AsyncDispose, Dispose>;
};

const getMethod = <Result>(value: object, key: symbol): (() => Result) | undefined => {
	const method = Reflect.get(value, key);

	if (method == null) return undefined;
	if (typeof method !== "function") throw new TypeError("Dispose method must be a function");

	return () => Reflect.apply(method, value, []) as Result;
};

const throwErrors = (errors: unknown[], SuppressedError: SuppressedErrorConstructor) => {
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1) throw errors.reduce((suppressed, error) => new SuppressedError(error, suppressed));
};

export const createDisposableStack = <Dispose extends symbol>(
	dispose: Dispose,
	SuppressedError: SuppressedErrorConstructor,
): DisposableStackConstructor<Dispose> => {
	class DisposableStack {
		#disposed = false;
		#stack: Array<() => void> = [];

		get disposed() {
			return this.#disposed;
		}

		use<T extends object | null | undefined>(value: T): T {
			this.#assertPending();

			if (value != null) {
				const method = getMethod<void>(value, dispose);

				if (!method) throw new TypeError("Object is not disposable");

				this.#stack.push(method);
			}

			return value;
		}

		adopt<T>(value: T, onDispose: (value: T) => void): T {
			this.#assertPending();

			this.#stack.push(() => onDispose(value));

			return value;
		}

		defer(onDispose: () => void): void {
			this.#assertPending();

			this.#stack.push(onDispose);
		}

		move(): DisposableStack {
			this.#assertPending();

			const stack = new DisposableStack();

			stack.#stack = this.#stack;

			this.#stack = [];
			this.#disposed = true;

			return stack;
		}

		dispose(): void {
			if (this.#disposed) return;

			this.#disposed = true;

			const errors: unknown[] = [];

			while (this.#stack.length) {
				try {
					this.#stack.pop()!();
				} catch (error) {
					errors.push(error);
				}
			}

			throwErrors(errors, SuppressedError);
		}

		get [Symbol.toStringTag]() {
			return "DisposableStack";
		}

		#assertPending() {
			if (this.#disposed) throw new ReferenceError("DisposableStack is already disposed");
		}
	}

	Object.defineProperty(DisposableStack.prototype, dispose, {
		value: DisposableStack.prototype.dispose,
		configurable: true,
		writable: true,
	});

	return DisposableStack as unknown as DisposableStackConstructor<Dispose>;
};

export const createAsyncDisposableStack = <AsyncDispose extends symbol, Dispose extends symbol>(
	asyncDispose: AsyncDispose,
	dispose: Dispose,
	SuppressedError: SuppressedErrorConstructor,
): AsyncDisposableStackConstructor<AsyncDispose, Dispose> => {
	class AsyncDisposableStack {
		#disposed = false;
		#stack: Array<() => void | PromiseLike<void>> = [];

		get disposed() {
			return this.#disposed;
		}

		use<T extends object | null | undefined>(value: T): T {
			this.#assertPending();

			if (value != null) {
				const method =
					getMethod<void | PromiseLike<void>>(value, asyncDispose) ?? getMethod<void>(value, dispose);

				if (!method) throw new TypeError("Object is not disposable");

				this.#stack.push(method);
			}

			return value;
		}

		adopt<T>(value: T, onDisposeAsync: (value: T) => void | PromiseLike<void>): T {
			this.#assertPending();

			this.#stack.push(() => onDisposeAsync(value));

			return value;
		}

		defer(onDisposeAsync: () => void | PromiseLike<void>): void {
			this.#assertPending();

			this.#stack.push(onDisposeAsync);
		}

		move(): AsyncDisposableStack {
			this.#assertPending();

			const stack = new AsyncDisposableStack();

			stack.#stack = this.#stack;

			this.#stack = [];
			this.#disposed = true;

			return stack;
		}

		async disposeAsync(): Promise<void> {
			if (this.#disposed) return;

			this.#disposed = true;

			const errors: unknown[] = [];

			while (this.#stack.length) {
				try {
					await this.#stack.pop()!();
				} catch (error) {
					errors.push(error);
				}
			}

			throwErrors(errors, SuppressedError);
		}

		get [Symbol.toStringTag]() {
			return "AsyncDisposableStack";
		}

		#assertPending() {
			if (this.#disposed) throw new ReferenceError("DisposableStack is already disposed");
		}
	}

	Object.defineProperty(AsyncDisposableStack.prototype, asyncDispose, {
		value: AsyncDisposableStack.prototype.disposeAsync,
		configurable: true,
		writable: true,
	});

	return AsyncDisposableStack as unknown as AsyncDisposableStackConstructor<AsyncDispose, Dispose>;
};
