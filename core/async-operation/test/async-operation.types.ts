import type { OperationView } from "../src/operation.js";
import { AsyncOperation, AsyncOperationSubscriber } from "../src/operation.js";

declare const executor: () => number;

const operation = new AsyncOperation<string, number>(executor);
const disposable: AsyncDisposable = operation;
const finished: Promise<void> = operation.finished;
const iterable: AsyncIterable<string> = operation;
const result: Promise<number> = operation.result;
const signal: AbortSignal = operation.signal;

operation.abort();

const subscriber = new AsyncOperationSubscriber<string, number>();
const lengths: OperationView<number> = subscriber.map((value) => value.length);
const filtered: OperationView<number> = lengths.filter((value) => value > 0);
const subscription: Disposable = filtered.subscribe((_value, _index) => {});
const consuming: Promise<number> = subscriber.consume(operation);

// @ts-expect-error A mapped view has the mapped value type.
const strings: OperationView<string> = lengths;

// @ts-expect-error An operation exposes its result explicitly and is not promise-like.
const promiseLike: PromiseLike<number> = operation;

void [
	disposable,
	finished,
	iterable,
	result,
	signal,
	subscriber,
	lengths,
	filtered,
	subscription,
	consuming,
	strings,
	promiseLike,
];
