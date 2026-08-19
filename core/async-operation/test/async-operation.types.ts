import { AsyncOperation } from "../src/operation.js";

declare const executor: () => number;

const operation = new AsyncOperation<string, number>(executor);
const disposable: AsyncDisposable = operation;
const finished: Promise<void> = operation.finished;
const iterable: AsyncIterable<string> = operation;
const result: Promise<number> = operation.result;
const signal: AbortSignal = operation.signal;

operation.abort();

// @ts-expect-error An operation exposes its result explicitly and is not promise-like.
const promiseLike: PromiseLike<number> = operation;

void [disposable, finished, iterable, result, signal, promiseLike];
