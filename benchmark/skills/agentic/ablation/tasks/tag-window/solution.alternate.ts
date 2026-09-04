import { Signal } from "@serve-tools/signal";
import { SignalSet } from "@serve-tools/signal-collections";
import { effect } from "@serve-tools/signal-effect";

export function createTagWindow(
	initial: Iterable<string>,
	publish: (snapshot: { count: number; tags: string[] }) => void,
) {
	if (typeof publish !== "function") {
		throw new TypeError("Expected publish");
	}
	const input = checked(initial);
	const tags = new SignalSet(input);
	const limit = new Signal.State(3);
	const view = new Signal.Computed(() => ({ count: tags.size, tags: Array.from(tags).slice(0, limit.get()) }));
	let disposed = false;
	const stop = effect(() => {
		const snapshot = view.get();
		if (!disposed) {
			publish({ count: snapshot.count, tags: [...snapshot.tags] });
		}
	});
	return {
		add(tag: string): boolean {
			assertTag(tag);
			if (tags.has(tag)) {
				return false;
			}
			tags.add(tag);
			return true;
		},
		delete(tag: string): boolean {
			assertTag(tag);
			return tags.delete(tag);
		},
		setLimit(next: number): void {
			if (!Number.isSafeInteger(next) || next < 0) {
				throw new TypeError("Invalid limit");
			}
			limit.set(next);
		},
		snapshot: () => {
			const snapshot = view.get();
			return { count: snapshot.count, tags: [...snapshot.tags] };
		},
		dispose(): void {
			if (!disposed) {
				disposed = true;
				stop();
			}
		},
	};
}

function checked(value: Iterable<string>): string[] {
	if (value === null || value === undefined || typeof value[Symbol.iterator] !== "function") {
		throw new TypeError("Expected tags");
	}
	if (Array.isArray(value) && Object.keys(value).length !== value.length) {
		throw new TypeError("Expected dense tags");
	}
	return Array.from(value, (tag) => {
		assertTag(tag);
		return tag;
	});
}

function assertTag(value: unknown): asserts value is string {
	if (typeof value !== "string" || value.length === 0) {
		throw new TypeError("Expected a tag");
	}
}
