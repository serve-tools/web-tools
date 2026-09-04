# Recipe: quick start

This public-import example is generated from the compile-checked `test/ponyfill-observable.recipes.ts` fixture in the package source.

```ts
import { Observable, when } from "@serve-tools/ponyfill-observable";

/** Creates reusable event consumption with independent counters and cancellation. */
export function observeClicks(target: EventTarget, signal: AbortSignal): Promise<Event[]> {
	return when(target, "click").take(3).toArray({ signal });
}

/** Every consumption obtains a fresh iterator and operator state. */
export function collectSquares(): Promise<number[]> {
	return Observable.from([1, 2, 3, 4])
		.filter((value) => value % 2 === 0)
		.map((value) => value ** 2)
		.toArray();
}

/** A producer owns resources until completion, error, or that consumption's cancellation. */
export function ticks(milliseconds: number): Observable<number> {
	return new Observable((subscriber) => {
		if (!subscriber.active) {
			return;
		}
		let count = 0;
		const timer = setInterval(() => subscriber.next(++count), milliseconds);
		subscriber.addTeardown(() => clearInterval(timer));
	});
}
```
