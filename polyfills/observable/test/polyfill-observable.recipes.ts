import "../src/polyfill-observable.js";
import { Observable } from "../src/exports/Observable.js";

/** Collects one event through the globally installed EventTarget method. */
export function nextEvent(target: EventTarget): Promise<Event[]> {
	return target.when("ready").take(1).toArray();
}

/** Creates a native-aware Observable without requiring global installation. */
export function values(): Promise<number[]> {
	return Observable.from([1, 2, 3]).toArray();
}
