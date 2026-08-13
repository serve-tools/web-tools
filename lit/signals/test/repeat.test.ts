import { Signal } from "@serve-tools/signal";
import { SignalArray, SignalObject } from "@serve-tools/signal-collections";
import { html, nothing, render } from "lit";
import { describe, expect, it } from "vitest";
import { repeat } from "../src/lit-signals.js";

interface Item {
	id: number;
	name: string;
}

describe("signal repeat", () => {
	it("reconciles structure by key and updates only a changed signal row", async () => {
		const first = new SignalObject<Item>({ id: 1, name: "first" });
		const second = new SignalObject<Item>({ id: 2, name: "second" });
		const items = new SignalArray([first, second]);
		const renders = new Map<number, number>();
		const container = document.createElement("div");
		const template = (item: SignalObject<Item>, index: number) => {
			renders.set(item.id, (renders.get(item.id) ?? 0) + 1);

			return html`<p data-id=${item.id}>${index}:${item.name}</p>`;
		};

		render(
			html`${repeat(
				() => items,
				(item) => item.id,
				template,
			)}`,
			container,
		);

		const firstNode = container.querySelector('[data-id="1"]');
		const secondNode = container.querySelector('[data-id="2"]');

		second.name = "updated";
		await Promise.resolve();

		expect(container.textContent).toContain("1:updated");
		expect(renders).toEqual(
			new Map([
				[1, 1],
				[2, 2],
			]),
		);
		expect(container.querySelector('[data-id="1"]')).toBe(firstNode);
		expect(container.querySelector('[data-id="2"]')).toBe(secondNode);

		const third = new SignalObject<Item>({ id: 3, name: "third" });

		items.push(third);
		await Promise.resolve();

		expect(renders).toEqual(
			new Map([
				[1, 1],
				[2, 2],
				[3, 1],
			]),
		);
		expect(container.querySelector('[data-id="1"]')).toBe(firstNode);
		expect(container.querySelector('[data-id="2"]')).toBe(secondNode);

		items.reverse();
		await Promise.resolve();

		expect(Array.from(container.querySelectorAll("p"), (node) => node.dataset.id)).toEqual(["3", "2", "1"]);
		expect(container.querySelector('[data-id="1"]')).toBe(firstNode);
		expect(container.querySelector('[data-id="2"]')).toBe(secondNode);

		render(nothing, container);
	});

	it("replaces only the row whose keyed item identity changes", async () => {
		const items = new SignalArray<Item>([
			{ id: 1, name: "first" },
			{ id: 2, name: "second" },
		]);
		const renders = new Map<number, number>();
		const container = document.createElement("div");
		const template = (item: Item) => {
			renders.set(item.id, (renders.get(item.id) ?? 0) + 1);

			return html`<p data-id=${item.id}>${item.name}</p>`;
		};

		render(
			html`${repeat(
				() => items,
				(item) => item.id,
				template,
			)}`,
			container,
		);

		const firstNode = container.querySelector('[data-id="1"]');

		items[1] = { id: 2, name: "replacement" };
		await Promise.resolve();

		expect(renders).toEqual(
			new Map([
				[1, 1],
				[2, 2],
			]),
		);
		expect(container.querySelector('[data-id="1"]')).toBe(firstNode);
		expect(container.textContent).toContain("replacement");

		render(nothing, container);
	});

	it("releases removed row dependencies", async () => {
		const name = new Signal.State("first");
		const items = new SignalArray([{ id: 1, name }]);
		const container = document.createElement("div");

		render(
			html`${repeat(
				() => items,
				(item) => item.id,
				(item) => item.name.get(),
			)}`,
			container,
		);

		expect(Signal.subtle.hasSinks(name)).toBe(true);

		items.pop();
		await Promise.resolve();
		await Promise.resolve();

		expect(container.textContent).toBe("");
		expect(Signal.subtle.hasSinks(name)).toBe(false);
	});

	it("supports a signal of immutable arrays and index-keyed shorthand", async () => {
		const items = new Signal.State<readonly string[]>(["first"]);
		const container = document.createElement("div");

		render(html`${repeat(items, (item, index) => html`${index}:${item}`)}`, container);

		items.set(["updated", "second"]);
		await Promise.resolve();

		expect(container.textContent).toBe("0:updated1:second");
	});
});
