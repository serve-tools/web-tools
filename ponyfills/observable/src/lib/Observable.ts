import { assertFunction, assertObject, defineStringTag, throwEmpty, throwError, toCount } from "./_internals.js";
import { onAbort, report } from "./lifecycle.js";
import type { Subscriber, SubscriptionObserver } from "./Subscriber.js";
import { __createSubscriber } from "./Subscriber.js";

/** A reusable recipe: every consumption starts a fresh execution. */
export class Observable<T> {
	constructor(callback: (subscriber: Subscriber<T>) => void) {
		assertFunction(callback, `callback`, Observable);

		this.#callback = callback;
	}

	/** Starts an independent execution; cancel it with options.signal. */
	subscribe(observer: ObserverUnion<T> = {}, options: SubscribeOptions = {}): void {
		const callbacks: SubscriptionObserver<T> = {};

		if (typeof observer === "function") {
			callbacks.next = observer;
		} else if (observer !== undefined) {
			assertObject(observer, `observer`, this.subscribe);

			for (const key of ["complete", "error", "next"] as const) {
				const callback = observer[key];

				if (callback !== undefined) {
					assertFunction(callback, `observer.${key}`, this.subscribe);

					callbacks[key] = callback as () => void;
				}
			}
		}

		const subscriber = __createSubscriber(callbacks, options.signal);

		try {
			const callback = this.#callback;

			callback(subscriber);
		} catch (error) {
			subscriber.error(error);
		}
	}

	/** Adapts a source without caching values or sharing Observable execution state. */
	static from<T>(value: ObservableInput<T>): Observable<T> {
		switch (true) {
			// biome-ignore lint/suspicious/useDefaultSwitchClauseLast: fallback
			default:
			// biome-ignore lint/complexity/noUselessSwitchCase: + nullishness check
			case value == null:
				return throwError(
					new TypeError("Expected an Observable, iterable, async iterable, or Promise"),
					Observable.from,
				);

			case value instanceof Observable:
				return value;

			case Symbol.iterator in value:
				assertFunction(value[Symbol.iterator], `value[Symbol.iterator]`, Observable.from);

				return new Observable((subscriber) => {
					if (!subscriber.active) {
						return;
					}

					const iterator = value[Symbol.iterator]();
					const next = iterator.next;

					assertFunction(next, `iterator.next`, Observable.from);

					let done = false;

					subscriber.addTeardown(() => {
						if (!done) {
							done = true;

							iterator.return?.();
						}
					});

					while (subscriber.active) {
						try {
							const result = next.call(iterator);

							assertObject(result, `iterator.next() result`, Observable.from);

							if (result.done) {
								done = true;

								subscriber.complete();

								return;
							}

							subscriber.next(result.value);
						} catch (error) {
							done = true;

							subscriber.error(error);

							return;
						}
					}
				});

			case Symbol.asyncIterator in value:
				assertFunction(value[Symbol.asyncIterator], `value[Symbol.asyncIterator]`, Observable.from);

				return new Observable((subscriber) => {
					if (!subscriber.active) {
						return;
					}

					const iterator = value[Symbol.asyncIterator]();
					const next = iterator.next;

					assertFunction(next, `iterator.next`, Observable.from);

					let done = false;

					subscriber.addTeardown(() => {
						if (!done) {
							done = true;
							Promise.resolve(iterator.return?.(subscriber.signal.reason)).catch(report);
						}
					});

					const consume = async () => {
						while (subscriber.active) {
							let result: IteratorResult<T>;

							try {
								result = await next.call(iterator);

								assertObject(result, `iterator.next() result`, Observable.from);

								if (result.done) {
									done = true;

									subscriber.complete();

									return;
								}

								subscriber.next(result.value);
							} catch (error) {
								subscriber.error(error);

								return;
							}
						}
					};

					void consume();
				});

			case "then" in value:
				assertFunction(value.then, `value.then`, Observable.from);

				return new Observable((subscriber) => {
					value.then(
						(item) => {
							subscriber.next(item);
							subscriber.complete();
						},
						(error: unknown) => subscriber.error(error),
					);
				});
		}
	}

	/** Maps values with an index local to each execution. */
	map<U>(mapper: (value: T, index: number) => U): Observable<U> {
		assertFunction(mapper, `mapper`, this.map);

		return this.#derive<U>((subscriber, value, index) => subscriber.next(mapper(value, index)));
	}

	/** Filters values with an index local to each execution. */
	filter<S extends T>(predicate: (value: T, index: number) => value is S): Observable<S>;
	filter(predicate: (value: T, index: number) => unknown): Observable<T>;
	filter(predicate: (value: T, index: number) => unknown): Observable<T> {
		assertFunction(predicate, `predicate`, this.filter);

		return this.#derive<T>((subscriber, value, index) => {
			if (predicate(value, index)) {
				subscriber.next(value);
			}
		});
	}

	/** Completes each execution after at most amount values, cancelling its source. */
	take(amount: number): Observable<T> {
		amount = toCount(amount);

		if (!amount) {
			return new Observable((subscriber) => subscriber.complete());
		}

		return this.#derive<T>((subscriber, value, index) => {
			if (index >= amount) {
				return;
			}

			subscriber.next(value);

			if (index + 1 >= amount) {
				subscriber.complete();
			}
		});
	}

	/** Skips the first amount values independently in each execution. */
	drop(amount: number): Observable<T> {
		amount = toCount(amount);

		return this.#derive<T>((subscriber, value, index) => {
			if (index >= amount) {
				subscriber.next(value);
			}
		});
	}

	/** Collects this consumption's values until completion. */
	toArray(options: SubscribeOptions = {}): Promise<T[]> {
		const values: T[] = [];

		return this.#consume(
			(value) => {
				values.push(value);
			},
			() => values,
			options,
		);
	}

	/** Visits values synchronously; a thrown exception rejects and cancels this consumption. */
	forEach(callback: (value: T, index: number) => void, options: SubscribeOptions = {}): Promise<void> {
		return this.#consume(
			(value, index) => callback(value, index),
			() => {},
			options,
			callback,
		);
	}

	/** Resolves the first value and cancels this consumption; rejects if empty. */
	first(options: SubscribeOptions = {}): Promise<T> {
		return this.#consume<T>(
			(value, _index, finish) => finish(value),
			() => throwEmpty(this.first),
			options,
		);
	}

	/** Resolves the last value of this consumption; rejects if empty. */
	last(options: SubscribeOptions = {}): Promise<T> {
		let last: T;
		let seen = false;

		return this.#consume(
			(value) => {
				last = value;
				seen = true;
			},
			() => (seen ? last : throwEmpty(this.last)),
			options,
		);
	}

	/** Resolves the first matching value, or undefined on empty completion. */
	find(predicate: (value: T, index: number) => unknown, options: SubscribeOptions = {}): Promise<T | undefined> {
		return this.#consume<T | undefined>(
			(value, index, finish) => {
				if (predicate(value, index)) {
					finish(value);
				}
			},
			() => undefined,
			options,
			predicate,
		);
	}

	/** Resolves whether a value matches, stopping this consumption at the first match. */
	some(predicate: (value: T, index: number) => unknown, options: SubscribeOptions = {}): Promise<boolean> {
		return this.#consume(
			(value, index, finish) => {
				if (predicate(value, index)) {
					finish(true);
				}
			},
			() => false,
			options,
			predicate,
		);
	}

	/** Resolves whether all values match, stopping this consumption at the first mismatch. */
	every(predicate: (value: T, index: number) => unknown, options: SubscribeOptions = {}): Promise<boolean> {
		return this.#consume(
			(value, index, finish) => {
				if (!predicate(value, index)) {
					finish(false);
				}
			},
			() => true,
			options,
			predicate,
		);
	}

	/** Reduces this consumption; an omitted seed uses the first value and rejects if empty. */
	reduce(reducer: (accumulator: T, value: T, index: number) => T): Promise<T>;
	reduce<U>(
		reducer: (accumulator: U, value: T, index: number) => U,
		initialValue: U,
		options?: SubscribeOptions,
	): Promise<U>;
	reduce<U>(
		reducer: (accumulator: U | T, value: T, index: number) => U | T,
		...args: [initialValue?: U, options?: SubscribeOptions]
	): Promise<U | T> {
		const [initialValue, options = {}] = args;

		let seen = args.length > 0;
		let accumulator: U | T = initialValue as U;

		return this.#consume(
			(value, index) => {
				accumulator = seen ? reducer(accumulator, value, index) : value;
				seen = true;
			},
			() => (seen ? accumulator : throwEmpty(this.reduce)),
			options,
			reducer,
		);
	}

	#derive<U>(next: (subscriber: Subscriber<U>, value: T, index: number) => void): Observable<U> {
		return new Observable((subscriber) => {
			if (!subscriber.active) {
				return;
			}

			let index = 0;

			this.subscribe(
				{
					next: (value) => {
						if (!subscriber.active) {
							return;
						}

						const current = index;

						++index;

						try {
							next(subscriber, value, current);
						} catch (error) {
							subscriber.error(error);
						}
					},
					error: (error) => subscriber.error(error),
					complete: () => subscriber.complete(),
				},
				{ signal: subscriber.signal },
			);
		});
	}

	#consume<R>(
		next: (value: T, index: number, finish: (value: R) => void) => void,
		complete: () => R,
		options: SubscribeOptions,
		callback: unknown = next,
	): Promise<R> {
		return new Promise((resolve, reject) => {
			assertFunction(callback, `callback`, this.#consume);

			const controller = new AbortController();

			let settled = false;
			let unlink = () => {};

			const finish = (failed: boolean, value: unknown) => {
				if (settled) {
					return;
				}

				settled = true;

				unlink();

				if (failed) {
					reject(value);
				} else {
					resolve(value as R);
				}

				controller.abort(failed ? value : undefined);
			};

			unlink = onAbort(options.signal, (reason) => finish(true, reason));

			if (settled) {
				return;
			}

			let index = 0;

			this.subscribe(
				{
					next: (value) => {
						if (settled) {
							return;
						}

						const current = index;

						++index;

						try {
							next(value, current, (result) => finish(false, result));
						} catch (error) {
							finish(true, error);
						}
					},
					error: (error) => finish(true, error),
					complete: () => {
						try {
							finish(false, complete());
						} catch (error) {
							finish(true, error);
						}
					},
				},
				{ signal: controller.signal },
			);
		});
	}

	#callback: (subscriber: Subscriber<T>) => void;

	static {
		defineStringTag(this, "Observable");
	}
}

export type ObservableSubscriptionCallback<T = any> = (value: T) => void;

/** Cancellation for one consumption; abort does not send a terminal notification. */
export interface SubscribeOptions {
	signal?: AbortSignal;
}

/** Object sources accepted by Observable.from(); iterables should return fresh iterators. */
export type ObservableInput<T> = Observable<T> | ((Iterable<T> | AsyncIterable<T> | PromiseLike<T>) & object);

export type ObserverUnion<T = unknown> = SubscriptionObserver<T> | ObservableSubscriptionCallback<T>;
