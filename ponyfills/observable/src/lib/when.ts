import { Observable } from "./Observable.js";

/** Ponyfill for target.when(type): each consumption owns its listener and execution. */
export function when(
	target: EventTarget,
	type: string,
	options: ObservableEventListenerOptions = {},
): Observable<Event> {
	const { capture = false, passive } = { ...options };

	return new Observable((subscriber) => {
		if (!subscriber.active) {
			return;
		}

		const listener = (event: Event) => subscriber.next(event);

		target.addEventListener(type, listener, passive === undefined ? { capture } : { capture, passive });

		subscriber.addTeardown(() => target.removeEventListener(type, listener, capture));
	});
}

/** Listener options from the proposed EventTarget.when() API. */
export interface ObservableEventListenerOptions {
	capture?: boolean;
	passive?: boolean;
}
