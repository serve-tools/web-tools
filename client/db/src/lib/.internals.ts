/// <reference lib="webworker" />

import type { DBTransaction, DBTransactionCallback, Method, Operation, SchemaDefinition, StoreName } from "./.types.js";

export const completion = (transaction: IDBTransaction, signal?: AbortSignal): Promise<void> =>
	new Promise((resolve, reject) => {
		let abortReason: unknown;

		const complete = () => {
			signal?.removeEventListener("abort", abort);
			resolve();
		};

		const aborted = () => {
			signal?.removeEventListener("abort", abort);
			reject(abortReason ?? transaction.error ?? new DOMException("Transaction aborted", "AbortError"));
		};

		const abort = () => {
			abortReason = signal?.reason;

			try {
				transaction.abort();
			} catch {}
		};

		transaction.oncomplete = complete;
		transaction.onabort = aborted;

		if (signal?.aborted) {
			abort();
		} else {
			signal?.addEventListener("abort", abort, { once: true });
		}
	});

export const completed = <Result>(operation: IDBRequest<Result>, signal?: AbortSignal): Promise<Result> =>
	completion(operation.transaction!, signal).then(() => operation.result);

export const execute = async <Schema extends SchemaDefinition<Schema>, Names extends StoreName<Schema>, Result>(
	transaction: DBTransaction<Schema, Names>,
	callback: DBTransactionCallback<Schema, Names, Result>,
): Promise<Awaited<Result>> => {
	try {
		return (await Promise.all([callback(transaction), transaction.done]))[0];
	} catch (error) {
		try {
			transaction.abort();
		} catch {}

		await transaction.done.catch(noop);

		throw error;
	}
};

export const exists = (value: unknown): boolean => value !== undefined;

export const invoke = <Result>(
	source: IDBIndex | IDBObjectStore,
	method: Method,
	value?: unknown,
	keyOrCount?: IDBValidKey | number,
): IDBRequest<Result> => ((source as IDBObjectStore)[method] as Operation<Result>)(value, keyOrCount);

export const noop = (): void => {};

export const requested = <Result>(
	source: IDBIndex | IDBObjectStore,
	method: Method,
	value?: unknown,
	keyOrCount?: IDBValidKey | number,
): Promise<Result> => result(invoke(source, method, value, keyOrCount));

export const result = <Result>(request: IDBRequest<Result>): Promise<Result> =>
	new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
