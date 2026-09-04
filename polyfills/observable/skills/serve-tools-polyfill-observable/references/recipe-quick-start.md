# Recipe: quick start

This public-import example is generated from the compile-checked `test/polyfill-observable.recipes.ts` fixture in the package source.

```ts
import "@serve-tools/polyfill-observable";
import { Observable } from "@serve-tools/polyfill-observable/Observable";

/** Collects one event through the globally installed EventTarget method. */
export function nextEvent(target: EventTarget): Promise<Event[]> {
	return target.when("ready").take(1).toArray();
}

/** Creates a native-aware Observable without requiring global installation. */
export function values(): Promise<number[]> {
	return Observable.from([1, 2, 3]).toArray();
}
```
