import { Signal } from "@serve-tools/signal";
import { SignalSet } from "@serve-tools/signal-collections";
import { effect } from "@serve-tools/signal-effect";
export function createTagWindow(
	initial: Iterable<string>,
	publish: (value: { count: number; tags: string[] }) => void,
) {
	if (typeof publish !== "function") {
		throw new TypeError("publish");
	}
	const tags = new SignalSet<string>();
	for (const tag of initial) {
		if (typeof tag !== "string" || !tag) {
			throw new TypeError("tag");
		}
		tags.add(tag);
	}
	const limit = new Signal.State(3);
	const snapshot = () => ({ count: tags.size, tags: [...tags].slice(0, limit.get()) });
	const stop = effect(() => publish(snapshot()));
	return {
		add(tag: string) {
			if (typeof tag !== "string" || !tag) {
				throw new TypeError("tag");
			}
			if (tags.has(tag)) {
				return false;
			}
			tags.add(tag);
			return true;
		},
		delete(tag: string) {
			if (typeof tag !== "string" || !tag) {
				throw new TypeError("tag");
			}
			return tags.delete(tag);
		},
		setLimit(next: number) {
			if (!Number.isSafeInteger(next) || next < 0) {
				throw new TypeError("limit");
			}
			if (!Object.is(limit.get(), next)) {
				limit.set(next);
			}
		},
		snapshot,
		dispose: stop,
	};
}
