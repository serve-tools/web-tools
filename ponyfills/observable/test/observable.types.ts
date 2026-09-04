import type { SubscribeOptions } from "@serve-tools/ponyfill-observable";
import { Observable, Subscriber, when } from "@serve-tools/ponyfill-observable";

const source = new Observable<number>((subscriber: Subscriber<number>) => {
	const signal: AbortSignal = subscriber.signal;
	if (!signal.aborted) {
		subscriber.next(1);
	}
	subscriber.complete();
});
const options: SubscribeOptions = { signal: new AbortController().signal };
const result: Promise<string> = source.reduce((text, value) => text + value, "", options);
const narrowed: Observable<string> = Observable.from([1, "two"]).filter((value) => typeof value === "string");
const promise = Promise.resolve(1);
const thenable: PromiseLike<number> = { then: promise.then.bind(promise) };
const thenableSource: Observable<number> = Observable.from(thenable);
const subscription = source.subscribe((value) => value.toFixed(), options);
const events: Promise<Event[]> = when(new EventTarget(), "tick").take(1).toArray(options);
void [result, narrowed, thenableSource, subscription, events, Subscriber];

// @ts-expect-error Observable.from deliberately rejects primitive strings instead of coercing them to iterables.
Observable.from("abc");

// @ts-expect-error A Subscriber is supplied to the producer, not publicly constructed.
new Subscriber();

// @ts-expect-error map preserves the mapped value type.
const numbers: Observable<number> = source.map(String);
void numbers;

// @ts-expect-error Subscribers only accept their declared value type.
new Observable<number>((subscriber) => subscriber.next("one"));
