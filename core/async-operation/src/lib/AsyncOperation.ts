export class AsyncOperation<T = void, TResult = void> implements AsyncIterable<T>, AsyncDisposable {
	constructor(executor: AsyncOperationExecutor<T, TResult>, options?: AsyncOperationOptions<T>) {
		const stream = new TransformStream<T, T>(
			{
				// @ts-expect-error as streamer is immediately assigned
				start: (controller) => (this.#streamer = controller),
			},
			undefined,
			options?.strategy,
		);

		this.#reader = stream.readable;
		this.#writer = stream.writable.getWriter();

		// cancelling the readable side errors the writable side.
		// observe its settlement so readable cancellation aborts the complete operation.
		const streamFinished = this.#writer.closed.catch((reason) => this.#abort(reason, false));

		// catch the rejection to avoid unhandled rejection logging
		void this.result.catch(() => {});

		const signal = options?.signal;

		if (!signal) {
			this.#finished = this.#execute(executor);

			return;
		}

		const abort = (): void => this.#abort(signal.reason);

		if (signal.aborted) {
			abort();

			this.#finished = streamFinished;

			return;
		}

		// allow the abort to be cleaned up when the operation is disposed
		signal.addEventListener("abort", abort, { once: true });

		// clean up the abort listener when the operation is disposed
		this.#finished = this.#execute(executor).finally(() => signal.removeEventListener("abort", abort));
	}

	/**
	 * Fulfills once the executor has stopped and value production has closed or errored.
	 *
	 * Never rejects — failure is reported through `result`; `finished`
	 * only reports that the operation is over.
	 */
	get finished(): Promise<void> {
		return this.#finished;
	}

	/** The operation's terminal result. */
	get result(): Promise<TResult> {
		return this.#resulter.promise;
	}

	/** Aborted when the operation is explicitly aborted, disposed, or value iteration is cancelled. */
	get signal(): AbortSignal {
		return this.#aborter.signal;
	}

	/**
	 * Aborts the operation.
	 *
	 * The executor is expected to observe `controller.signal` and stop
	 * cooperatively.
	 */
	abort(reason?: unknown): void {
		this.#abort(reason);
	}

	/** Iterates values directly. */
	[Symbol.asyncIterator](): AsyncIterator<T> {
		return this.#reader.values();
	}

	/** Aborts an active executor and waits for the executor and value production to stop. */
	[Symbol.asyncDispose](): Promise<void> {
		if (this.#state === OperationState.ACTIVE) {
			this.#abort(new DOMException("The operation was disposed.", "AbortError"));
		}

		return this.#finished;
	}

	async #execute(executor: AsyncOperationExecutor<T, TResult>): Promise<void> {
		const signal = this.#aborter.signal;
		const settle = (): void => {
			--this.#pendingWrites;
		};

		try {
			const value = await executor({
				signal,
				write: (value) => {
					if (this.#state !== OperationState.ACTIVE) {
						return Promise.reject(
							signal.aborted
								? signal.reason
								: new DOMException("The operation is no longer accepting values.", "InvalidStateError"),
						);
					}

					const writing = this.#writer.write(value);

					++this.#pendingWrites;

					void writing.then(settle, settle);

					return writing;
				},
			});

			if (this.#state !== OperationState.ACTIVE) {
				return;
			}

			if (this.#pendingWrites !== 0) {
				this.#reject(new DOMException("The executor returned with pending writes.", "InvalidStateError"));

				return;
			}

			this.#state = OperationState.COMPLETING;

			// close the writer, which will also close the reader
			// await for accepted writes to drain
			await this.#writer.close();

			if (this.#state !== OperationState.COMPLETING) {
				return;
			}

			this.#state = OperationState.SETTLED;

			this.#resulter.resolve(value);
		} catch (reason) {
			this.#reject(reason);
		}
	}

	#abort(reason: unknown, abortWritable = true): void {
		if (this.#state === OperationState.SETTLED) {
			return;
		}

		this.#aborter.abort(reason);

		this.#reject(this.signal.reason, abortWritable);
	}

	#reject(reason: unknown, abortWritable = true): void {
		if (this.#state === OperationState.SETTLED) {
			return;
		}

		this.#state = OperationState.SETTLED;

		this.#resulter.reject(reason);

		if (abortWritable) {
			// error both sides directly so backpressure cannot postpone shutdown.
			this.#streamer.error(reason);
		}
	}

	/** Represents the abort controller for the operation. */
	readonly #aborter = new AbortController();

	/** Represents the promise that will be resolved with the operation's result. */
	readonly #resulter = Promise.withResolvers<TResult>();

	/** Represents the promise that will be resolved when the operation is finished. */
	readonly #finished: Promise<void>;

	/** Represents the readable stream for the operation. */
	readonly #reader: ReadableStream<T>;

	/** Represents the transform stream controller for the operation. */
	readonly #streamer!: TransformStreamDefaultController<T>;

	/** Represents the writable stream writer for the operation. */
	readonly #writer: WritableStreamDefaultWriter<T>;

	/** Represents the number of writes that have not settled. */
	#pendingWrites: number = 0;

	/** Represents the operation's current lifecycle phase. */
	#state: OperationState = OperationState.ACTIVE;
}

/** Controls value delivery and observes cancellation. */
export interface AsyncOperationController<T> {
	/** Aborted when the operation is cancelled. */
	readonly signal: AbortSignal;

	/** Writes a value, applying stream backpressure; it must settle before the executor returns. */
	write(value: T): Promise<void>;
}

/** Produces values and a terminal result. */
export type AsyncOperationExecutor<T, TResult> = (
	controller: AsyncOperationController<T>,
) => TResult | PromiseLike<TResult>;

/** Configures cancellation and value buffering. */
export interface AsyncOperationOptions<T> {
	/** An upstream signal whose abort cancels the operation. */
	readonly signal?: AbortSignal;

	/** Controls value buffering and sizing. */
	readonly strategy?: QueuingStrategy<T>;
}

const enum OperationState {
	ACTIVE,
	COMPLETING,
	SETTLED,
}
