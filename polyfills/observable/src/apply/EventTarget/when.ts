import type {
	ObservableEventListenerOptions,
	Observable as ObservableInstance,
} from "@serve-tools/ponyfill-observable";
import { when as value } from "../../exports/EventTarget/when.js";

const EventTargetConstructor = Reflect.get(globalThis, "EventTarget");

if (typeof EventTargetConstructor === "function" && Reflect.get(EventTargetConstructor.prototype, "when") == null) {
	Object.defineProperty(EventTargetConstructor.prototype, "when", {
		value,
		configurable: true,
		writable: true,
	});
}

declare global {
	interface EventTarget {
		/** Creates an Observable whose independent executions listen for this event type. */
		when(type: string, options?: ObservableEventListenerOptions): ObservableInstance<Event>;
	}
}
