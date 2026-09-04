import { expect, test } from "vitest";
import { benchmark } from "../../benchmark.js";
import { PersistentFragment } from "../dist/client-dom-fragment.js";

test("persistent fragment operations", async () => {
	const host = document.createElement("div");
	const other = document.createElement("div");
	document.body.append(host, other);

	try {
		for (const count of [0, 1, 10, 100]) {
			const nodes = Array.from({ length: count }, () => document.createElement("span"));
			const fragment = new PersistentFragment(nodes);
			fragment.insertBefore(host);

			await benchmark(
				`dom-fragment/toggle-${count}`,
				() => {
					fragment.hidden = true;
					fragment.hidden = false;
				},
				{ iterations: Math.max(2_000, Math.floor(200_000 / Math.max(1, count))), samples: 15, warmup: 5 },
			);
			expect(fragment.nodes).toEqual(nodes);
			expect(host.children.length).toBe(count);

			await benchmark(
				`dom-fragment/move-${count}`,
				() => {
					fragment.insertBefore(other);
					fragment.insertBefore(host);
				},
				{ iterations: Math.max(1_000, Math.floor(50_000 / Math.max(1, count))), samples: 15, warmup: 5 },
			);
			expect(fragment.nodes).toEqual(nodes);
			expect(other.childNodes.length).toBe(0);
			fragment.remove();
		}

		const fragment = new PersistentFragment();
		fragment.insertBefore(host);
		await benchmark(
			"dom-fragment/unchanged-visibility",
			() => {
				fragment.hidden = false;
			},
			{ iterations: 10_000_000 },
		);
		expect(host.childNodes.length).toBe(2);
		fragment.remove();

		await benchmark(
			"dom-fragment/create-insert-remove",
			() => {
				const region = new PersistentFragment([document.createElement("span")]);
				region.insertBefore(host);
				region.remove();
			},
			{ iterations: 40_000 },
		);
		expect(host.childNodes.length).toBe(0);
	} finally {
		host.remove();
		other.remove();
	}
});
