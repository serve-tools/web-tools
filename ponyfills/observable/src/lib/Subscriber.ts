import { defineStringTag, throwError } from "./_internals.js";
import { notify, onAbort, report, requireCallback } from "./lifecycle.js";

export let __createSubscriber: <T>(observer: SubscriptionObserver<T>, signal?: AbortSignal) => Subscriber<T>;
const constructionKey = {};

/**
 * The **`Subscriber`** interface of the Observable API represents a subscription to a stream of observable values, and contains methods to manage the lifecycle of that subscription.
 */
export class Subscriber<T = any> {
	private constructor(key: object) {
		if (key !== constructionKey) {
			throwError(new TypeError("Illegal constructor"), Subscriber);
		}
	}

	/** Whether this execution still accepts values or a terminal notification. */
	get active(): boolean {
		return this.#active;
	}

	/** Aborts on cancellation, error, or completion, before teardown runs. */
	get signal(): AbortSignal {
		return this.#controller.signal;
	}

	/** Delivers a value synchronously while active. */
	next(value: T): void {
		if (!this.#active) {
			return;
		}

		const next = this.#observer.next;

		try {
			next?.(value);
		} catch (error) {
			report(error);
		}
	}

	/** Closes the execution and reports its error; late errors are reported globally. */
	error(error: unknown): void {
		if (!this.#active) {
			report(error);

			return;
		}

		const callback = this.#observer.error ?? report;

		this.#close(error);

		notify(() => callback(error));
	}

	/** Closes the execution before notifying the observer of completion. */
	complete(): void {
		if (!this.#active) {
			return;
		}

		const complete = this.#observer.complete;

		this.#close();

		notify(complete);
	}

	/** Registers synchronous cleanup in reverse order, or runs it immediately if closed. */
	addTeardown(teardown: () => void): void {
		requireCallback(teardown);

		if (this.#active) {
			this.#teardowns.push(teardown);
		} else {
			notify(teardown);
		}
	}

	#close(reason?: unknown): void {
		if (!this.#active) {
			return;
		}

		this.#active = false;

		this.#observer = {};
		this.#unlink?.();

		this.#unlink = undefined;

		this.#controller.abort(reason);

		while (this.#teardowns.length) {
			notify(this.#teardowns.pop());
		}
	}

	#active = true;
	#controller = new AbortController();
	#observer!: SubscriptionObserver<T>;
	#teardowns: (() => void)[] = [];
	#unlink: (() => void) | undefined;

	static {
		defineStringTag(this, "Subscriber");

		__createSubscriber = (observer, signal) => {
			const subscriber = new Subscriber(constructionKey);

			subscriber.#observer = observer;
			subscriber.#unlink = onAbort(signal, (reason) => subscriber.#close(reason));

			return subscriber;
		};
	}
}

/** Callbacks receiving one execution's values and terminal notification. */
export interface SubscriptionObserver<T> {
	next?: (value: T) => void;
	error?: (error: unknown) => void;
	complete?: () => void;
}
