import type { AsyncDisposable, Disposable } from "@serve-tools/ponyfill-resource-management";
import {
	AsyncDisposableStack,
	asyncDispose,
	dispose,
	SuppressedError,
} from "@serve-tools/ponyfill-resource-management";

const finishScope = Symbol("finish resource scope");

/** Registers each resource in a package-owned child stack so individual cleanup failures remain ordered. */
export class ScopedResources {
	use<Value extends AsyncDisposable | Disposable | null | undefined>(value: Value): Value {
		this.#assertActive();

		const child = new AsyncDisposableStack();

		child.use(value);
		this.#register(child);

		return value;
	}

	adopt<Value>(value: Value, cleanup: (value: Value) => void | PromiseLike<void>): Value {
		this.#assertActive();

		const child = new AsyncDisposableStack();

		child.adopt(value, cleanup);
		this.#register(child);

		return value;
	}

	defer(cleanup: () => void | PromiseLike<void>): void {
		this.#assertActive();

		const child = new AsyncDisposableStack();

		child.defer(cleanup);
		this.#register(child);
	}

	/** Disposes without a work error, preserving the package's one-error and nested multi-error shape. */
	async disposeAsync(): Promise<void> {
		const errors = await this[finishScope]();

		if (errors.length) {
			throw combineFailures(errors);
		}
	}

	async [asyncDispose](): Promise<void> {
		await this.disposeAsync();
	}

	async [finishScope](): Promise<readonly unknown[]> {
		this.#active = false;
		this.#finished ??= this.#stack.disposeAsync().then(() => this.#errors);

		return await this.#finished;
	}

	#assertActive(): void {
		if (!this.#active) {
			throw new ReferenceError("The resource scope is already disposed");
		}
	}

	#register(child: AsyncDisposableStack): void {
		this.#stack.defer(async () => {
			try {
				await child.disposeAsync();
			} catch (error) {
				this.#errors.push(error);
			}
		});
	}

	#active = true;
	readonly #errors: unknown[] = [];
	#finished: Promise<readonly unknown[]> | undefined;
	readonly #stack = new AsyncDisposableStack();
}

/** Runs acquisition and work in one scope, then nests every later cleanup failure above the earlier failure. */
export const runResourceScope = async <Value>(
	work: (scope: ScopedResources) => Value | PromiseLike<Value>,
): Promise<Value> => {
	const scope = new ScopedResources();

	let failed = false;
	let failure: unknown;
	let value: Value | undefined;

	try {
		value = await work(scope);
	} catch (error) {
		failed = true;
		failure = error;
	}

	const cleanupErrors = await scope[finishScope]();

	if (cleanupErrors.length || failed) {
		throw combineFailures(cleanupErrors, failed, failure);
	}

	return value as Value;
};

const combineFailures = (cleanupErrors: readonly unknown[], failed = false, failure?: unknown): unknown => {
	let combined = failure;
	let hasFailure = failed;

	for (const cleanupError of cleanupErrors) {
		combined = hasFailure ? new SuppressedError(cleanupError, combined) : cleanupError;
		hasFailure = true;
	}

	return combined;
};

/** Helpers for adapting resources to this ponyfill's module-scoped symbol identity. */
export const resourceSymbols = { dispose, asyncDispose } as const;

// Add your task adapter below.
