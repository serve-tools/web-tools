import { nothing, render } from "lit";
import { describe, expect, it } from "vitest";
import { AsyncOperation, AsyncOperationSubscriber, html, observeOperationView, Signal } from "../src/lit-signals.js";

describe("observeOperationView", () => {
	it("retains a filtered and mapped view's latest value as a read-only Signal", async () => {
		const subscriber = new AsyncOperationSubscriber<number>();
		const observation = observeOperationView(
			subscriber.filter((value) => value % 2 === 0).map((value) => value * 2),
		);

		try {
			const operation = new AsyncOperation<number>(async ({ write }) => {
				await write(1);
				await write(2);
				await write(4);
			});

			expect(Signal.isComputed(observation)).toBe(true);
			expect(observation.get()).toBeUndefined();

			await subscriber.consume(operation);

			expect(observation.get()).toBe(8);
			expect(observation.active).toBe(true);
		} finally {
			observation.dispose();
		}
	});

	it("renders one view Signal directly in a signal-native template", async () => {
		const subscriber = new AsyncOperationSubscriber<string>();
		const latestLength = observeOperationView(
			subscriber.map((value) => value.length),
			"Waiting",
		);
		const container = document.createElement("div");

		try {
			render(html`<p>${latestLength}</p>`, container);
			expect(container.textContent).toBe("Waiting");

			await subscriber.consume(
				new AsyncOperation<string>(async ({ write }) => {
					await write("loading");
				}),
			);
			await Promise.resolve();

			expect(container.textContent).toBe("7");
		} finally {
			render(nothing, container);
			latestLength.dispose();
		}
	});

	it("unsubscribes independently and retains its current value", async () => {
		const subscriber = new AsyncOperationSubscriber<number>();
		const first = observeOperationView(subscriber, 0);
		const second = observeOperationView(subscriber, 0);

		first.dispose();
		await subscriber.consume(
			new AsyncOperation<number>(async ({ write }) => {
				await write(1);
			}),
		);

		expect(first.active).toBe(false);
		expect(first.get()).toBe(0);
		expect(second.get()).toBe(1);

		second.dispose();
	});
});
