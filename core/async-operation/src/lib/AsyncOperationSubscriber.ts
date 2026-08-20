/// <reference lib="esnext.disposable" preserve="true" />

import type { AsyncOperation } from "./AsyncOperation.js";

type Awaitable<T> = T | PromiseLike<T>;
type ViewCallback<T> = (value: T, index: number) => Awaitable<void>;
type Task = () => Awaitable<void>;

/** A composable projection over an AsyncOperation subscription. */
export interface OperationView<T> {
	filter<TPart extends T>(predicate: (value: T, index: number) => value is TPart): OperationView<TPart>;

	filter(predicate: (value: T, index: number) => unknown): OperationView<T>;

	map<TPart>(callback: (value: T, index: number) => Awaitable<TPart>): OperationView<TPart>;

	/** Attaches a terminal consumer that observes future values from this view. */
	subscribe(callback: ViewCallback<T>): Disposable;
}

/**
 * Owns and drains one AsyncOperation while dispatching its values through
 * a shared filter/map projection graph.
 */
export class AsyncOperationSubscriber<T, TResult = void> implements AsyncDisposable {
	constructor() {
		this.#view = new OperationViewImplementation(
			this.#root,
			() => this.#assertConfigurable(),
			() => this.#assertSubscribable(),
		);
	}

	/** Whether this subscriber is currently consuming an operation. */
	get active(): boolean {
		return this.#active;
	}

	filter<TPart extends T>(predicate: (value: T, index: number) => value is TPart): OperationView<TPart>;

	filter(predicate: (value: T, index: number) => unknown): OperationView<T>;

	filter<TPart extends T = T>(predicate: (value: T, index: number) => unknown): OperationView<TPart> {
		return this.#view.filter(predicate) as OperationView<TPart>;
	}

	map<TPart>(callback: (value: T, index: number) => Awaitable<TPart>): OperationView<TPart> {
		return this.#view.map(callback);
	}

	subscribe(callback: ViewCallback<T>): Disposable {
		return this.#view.subscribe(callback);
	}

	/**
	 * Starts consuming an operation.
	 *
	 * Every matching subscriber settles before the next operation value is
	 * requested. Resolves with the operation's terminal result.
	 */
	consume(operation: AsyncOperation<T, TResult>): Promise<TResult> {
		if (this.#disposed) {
			throw new DOMException("The subscriber has been disposed.", "InvalidStateError");
		}

		if (this.#started) {
			throw new DOMException("The subscriber has already consumed an operation.", "InvalidStateError");
		}

		this.#started = true;
		this.#active = true;
		this.#operation = operation;

		const consuming = this.#consume(operation);

		this.#consuming = consuming;

		// Avoid unhandled rejection logging when disposal is the only awaited lifecycle surface.
		// The original promise remains rejectable.
		void consuming.catch(() => {});

		return consuming;
	}

	[Symbol.asyncDispose](): Promise<void> {
		this.#disposePromise ??= this.#dispose();

		return this.#disposePromise;
	}

	async #consume(operation: AsyncOperation<T, TResult>): Promise<TResult> {
		let iterator: AsyncIterator<T> | undefined;

		try {
			iterator = operation[Symbol.asyncIterator]();

			while (true) {
				const next = await iterator.next();

				if (next.done) {
					break;
				}

				await this.#root.emit(next.value);
			}

			return await operation.result;
		} catch (reason) {
			// Do not abort an operation when this subscriber failed to acquire its iterator;
			// another consumer may already own it.
			if (iterator !== undefined) {
				// Establish the projection failure as the operation's canonical cancellation reason
				// before cancelling the readable iterator.
				operation.abort(reason);

				try {
					await iterator.return?.();
				} catch {
					// Preserve the original operation or projection failure.
				}

				await operation.finished;
			}

			throw reason;
		} finally {
			this.#active = false;
		}
	}

	async #dispose(): Promise<void> {
		this.#disposed = true;

		if (!this.#operation) {
			return;
		}

		await this.#operation[Symbol.asyncDispose]();

		try {
			await this.#consuming;
		} catch {
			// The outcome remains observable through consume().
		}
	}

	#assertConfigurable(): void {
		if (this.#started || this.#disposed) {
			throw new DOMException("The subscriber can no longer be configured.", "InvalidStateError");
		}
	}

	#assertSubscribable(): void {
		if (this.#disposed) {
			throw new DOMException("The subscriber has been disposed.", "InvalidStateError");
		}
	}

	readonly #root = new ViewNode<T>();
	readonly #view: OperationViewImplementation<T>;

	#active = false;
	#consuming: Promise<TResult> | undefined;
	#disposed = false;
	#disposePromise: Promise<void> | undefined;
	#operation: AsyncOperation<T, TResult> | undefined;
	#started = false;
}

class OperationViewImplementation<T> implements OperationView<T> {
	constructor(node: ViewNode<T>, assertConfigurable: () => void, assertSubscribable: () => void) {
		this.#assertConfigurable = assertConfigurable;
		this.#assertSubscribable = assertSubscribable;
		this.#node = node;
	}

	filter<TPart extends T>(predicate: (value: T, index: number) => value is TPart): OperationView<TPart>;

	filter(predicate: (value: T, index: number) => unknown): OperationView<T>;

	filter<TPart extends T = T>(predicate: (value: T, index: number) => unknown): OperationView<TPart> {
		this.#assertConfigurable();

		const output = new ViewNode<TPart>();

		this.#node.addTarget(new FilterTarget<T, TPart>(predicate, output));

		return new OperationViewImplementation(output, this.#assertConfigurable, this.#assertSubscribable);
	}

	map<TPart>(callback: (value: T, index: number) => Awaitable<TPart>): OperationView<TPart> {
		this.#assertConfigurable();

		const output = new ViewNode<TPart>();

		this.#node.addTarget(new MapTarget(callback, output));

		return new OperationViewImplementation(output, this.#assertConfigurable, this.#assertSubscribable);
	}

	subscribe(callback: ViewCallback<T>): Disposable {
		this.#assertSubscribable();

		const subscription = new ViewSubscription(this.#node, callback);

		this.#node.addSubscription(subscription);

		return subscription;
	}

	readonly #assertConfigurable: () => void;
	readonly #assertSubscribable: () => void;
	readonly #node: ViewNode<T>;
}

interface ViewTarget<T> {
	/** Whether this target has at least one terminal subscriber downstream. */
	readonly active: boolean;

	dispatch(value: T, index: number): Promise<void>;
}

class ViewNode<T> {
	get active(): boolean {
		if (this.#subscriptions.size !== 0) {
			return true;
		}

		for (const target of this.#targets) {
			if (target.active) {
				return true;
			}
		}

		return false;
	}

	addSubscription(subscription: ViewSubscription<T>): void {
		this.#subscriptions.add(subscription);
	}

	deleteSubscription(subscription: ViewSubscription<T>): void {
		this.#subscriptions.delete(subscription);
	}

	addTarget(target: ViewTarget<T>): void {
		this.#targets.add(target);
	}

	async emit(value: T): Promise<void> {
		const index = this.#nextIndex;
		const tasks: Task[] = [];

		++this.#nextIndex;

		// Snapshot both collections so mutations during delivery affect only subsequent values.
		for (const subscription of [...this.#subscriptions]) {
			tasks.push(() => subscription.invoke(value, index));
		}

		for (const target of [...this.#targets]) {
			if (target.active) {
				tasks.push(() => target.dispatch(value, index));
			}
		}

		await runTasks(tasks);
	}

	readonly #subscriptions = new Set<ViewSubscription<T>>();
	readonly #targets = new Set<ViewTarget<T>>();

	#nextIndex = 0;
}

class FilterTarget<TInput, TOutput extends TInput> implements ViewTarget<TInput> {
	constructor(predicate: (value: TInput, index: number) => unknown, output: ViewNode<TOutput>) {
		this.#output = output;
		this.#predicate = predicate;
	}

	get active(): boolean {
		return this.#output.active;
	}

	async dispatch(value: TInput, index: number): Promise<void> {
		if (!this.#predicate(value, index)) {
			return;
		}

		// TOutput is justified by the public type-predicate overload.
		await this.#output.emit(value as TOutput);
	}

	readonly #output: ViewNode<TOutput>;
	readonly #predicate: (value: TInput, index: number) => unknown;
}

class MapTarget<TInput, TOutput> implements ViewTarget<TInput> {
	constructor(callback: (value: TInput, index: number) => Awaitable<TOutput>, output: ViewNode<TOutput>) {
		this.#callback = callback;
		this.#output = output;
	}

	get active(): boolean {
		return this.#output.active;
	}

	async dispatch(value: TInput, index: number): Promise<void> {
		const output = await this.#callback(value, index);

		await this.#output.emit(output);
	}

	readonly #callback: (value: TInput, index: number) => Awaitable<TOutput>;
	readonly #output: ViewNode<TOutput>;
}

class ViewSubscription<T> implements Disposable {
	constructor(node: ViewNode<T>, callback: ViewCallback<T>) {
		this.#callback = callback;
		this.#node = node;
	}

	[Symbol.dispose](): void {
		if (!this.#callback) {
			return;
		}

		this.#node.deleteSubscription(this);
		this.#callback = undefined;
	}

	invoke(value: T, index: number): Awaitable<void> {
		return this.#callback?.(value, index);
	}

	#callback: ViewCallback<T> | undefined;
	readonly #node: ViewNode<T>;
}

/**
 * Starts every matching branch concurrently, waits for all of them, and then
 * reports the first failure in deterministic registration order.
 */
const runTasks = async (tasks: readonly Task[]): Promise<void> => {
	const results = await Promise.allSettled(tasks.map(invokeTask));

	for (const result of results) {
		if (result.status === "rejected") {
			throw result.reason;
		}
	}
};

const invokeTask = (task: Task): Promise<void> => {
	try {
		return Promise.resolve(task());
	} catch (reason) {
		return Promise.reject(reason);
	}
};
