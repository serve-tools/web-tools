import { Signal } from "@serve-tools/signal";
import { SignalMap } from "@serve-tools/signal-collections";
import { effect } from "@serve-tools/signal-effect";

interface Entry {
	readonly id: string;
	readonly score: number;
}

export function createReactiveLeaderboard(
	initial: Iterable<readonly [string, number]>,
	publish: (value: Entry[]) => void,
) {
	if (typeof publish !== "function") {
		throw new TypeError("Expected publish");
	}

	const scores = new SignalMap<string, number>();

	for (const [id, score] of initial) {
		validate(id, score);
		scores.set(id, score);
	}

	const sorted = new Signal.Computed(() =>
		Array.from(scores, ([id, score]) => ({ id, score })).sort(
			(left, right) => right.score - left.score || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
		),
	);
	const snapshot = (): Entry[] => sorted.get().map((entry) => ({ ...entry }));
	const stop = effect(() => publish(snapshot()));

	return {
		setScore(id: string, score: number): void {
			validate(id, score);
			scores.set(id, score);
		},
		remove(id: string): boolean {
			if (typeof id !== "string") {
				throw new TypeError("Expected string id");
			}

			return scores.delete(id);
		},
		snapshot,
		dispose: stop,
	};
}

function validate(id: unknown, score: unknown): asserts id is string {
	if (typeof id !== "string" || typeof score !== "number" || !Number.isFinite(score)) {
		throw new TypeError("Expected a string id and finite score");
	}
}
