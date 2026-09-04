import type {
	ObservableEventListenerOptions,
	Observable as ObservableInstance,
} from "@serve-tools/ponyfill-observable";
import { Observable } from "../Observable.js";

/** The receiver method contract for creating an Observable from events. */
export interface EventTargetWhen {
	(this: EventTarget, type: string, options?: ObservableEventListenerOptions): ObservableInstance<Event>;
}

const EventTargetConstructor = Reflect.get(globalThis, "EventTarget");
const nativeValue =
	typeof EventTargetConstructor === "function" ? Reflect.get(EventTargetConstructor.prototype, "when") : undefined;

/** The native EventTarget.prototype.when method when available, otherwise a selected-Observable adapter. */
export const when: EventTargetWhen =
	nativeValue != null
		? nativeValue
		: function when(this: EventTarget, type, options = {}) {
				const { capture = false, passive } = { ...options };

				return new Observable((subscriber) => {
					if (!subscriber.active) {
						return;
					}

					const listener = (event: Event) => subscriber.next(event);

					this.addEventListener(type, listener, passive === undefined ? { capture } : { capture, passive });
					subscriber.addTeardown(() => this.removeEventListener(type, listener, capture));
				});
			};
