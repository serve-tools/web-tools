import { expect, test } from "vitest";

import { benchmark } from "../../benchmark.js";
import { observePointer } from "../src/lib/pointer.js";

test("pointer session hot path", async () => {
	const target = new BenchmarkPointerElement();
	const element = target as unknown as Element;
	const pointerDown = new PointerEvent("pointerdown", { pointerId: 1, clientX: 25, clientY: 50 });
	const pointerUp = new PointerEvent("pointerup", { pointerId: 1, clientX: 75, clientY: 100 });
	const stop = observePointer(element, {});

	await benchmark(
		"client-input/pointer-start-end",
		() => {
			target.dispatchEvent(pointerDown);
			target.dispatchEvent(pointerUp);
		},
		{ iterations: 100_000 },
	);

	stop();
	expect(target.captures).toBeGreaterThan(0);
});

class BenchmarkPointerElement extends EventTarget {
	captures = 0;
	readonly rect = new DOMRect(10, 20, 100, 200);

	getBoundingClientRect(): DOMRect {
		return this.rect;
	}

	hasPointerCapture(): boolean {
		return false;
	}

	releasePointerCapture(): void {}

	setPointerCapture(): void {
		++this.captures;
	}
}
