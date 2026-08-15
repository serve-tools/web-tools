/// <reference lib="dom" />

import { Signal } from "@serve-tools/signal";
import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { attrs, css, dispose, group, html, props, text } from "../src/signal-dom.js";

const microtask = () => new Promise<void>(queueMicrotask);
let _sink: unknown;

test("DOM creation and binding hot paths", async () => {
	const staticTemplate = html(
		"article",
		attrs({ class: "card", id: "item", title: "ready" }),
		props({ tabIndex: 0 }),
		html("h2", text("Title")),
		html("p", text("Description")),
	);

	await benchmark(
		"signal-dom/static-element-tree-create",
		() => {
			_sink = staticTemplate();
		},
		{ iterations: 50_000 },
	);

	const title = new Signal.State("ready");
	const content = new Signal.State("content");
	const reactiveTemplate = html("article", attrs({ title }), text(content));

	await benchmark(
		"signal-dom/reactive-element-create-dispose",
		() => {
			const element = reactiveTemplate();

			dispose(element);
			_sink = element;
		},
		{ iterations: 20_000 },
	);

	const denseReactiveTemplate = html(
		"article",
		attrs({
			"data-a": title,
			"data-b": title,
			"data-c": title,
			"data-d": title,
			"data-e": title,
			"data-f": title,
			title,
		}),
	);

	await benchmark(
		"signal-dom/reactive-element-create-dispose-7-bindings",
		() => {
			const element = denseReactiveTemplate();

			dispose(element);
			_sink = element;
		},
		{ iterations: 10_000 },
	);
});

test("reactive DOM update hot paths", async () => {
	const textValue = new Signal.State(0);
	const textNodes = Array.from({ length: 1_000 }, () => text(textValue)());
	let nextText = 0;

	await benchmark(
		"signal-dom/text-update-1k-bindings",
		async () => {
			textValue.set(++nextText);
			await microtask();
		},
		{ iterations: 500, samples: 10, warmup: 3 },
	);

	for (const node of textNodes) {
		dispose(node);
	}

	const title = new Signal.State(0);
	const elements = Array.from({ length: 1_000 }, () => html("div", attrs({ title }))());
	let nextTitle = 0;

	await benchmark(
		"signal-dom/attribute-update-1k-bindings",
		async () => {
			title.set(++nextTitle);
			await microtask();
		},
		{ iterations: 500, samples: 10, warmup: 3 },
	);

	for (const element of elements) {
		dispose(element);
	}
});

test("stylesheet creation and update hot paths", async () => {
	await benchmark(
		"signal-dom/static-stylesheet-create",
		() => {
			_sink = css`:host { color: ${"red"}; display: ${"block"}; opacity: ${1}; }`;
		},
		{ iterations: 20_000 },
	);

	const color = new Signal.State("red");
	const sheets = Array.from(
		{ length: 1_000 },
		() => css`:host { color: ${color}; border-color: ${color}; background: ${color}; }`,
	);
	let nextColor = false;

	await benchmark(
		"signal-dom/stylesheet-update-1k-bindings",
		async () => {
			color.set((nextColor = !nextColor) ? "blue" : "red");
			await microtask();
		},
		{ iterations: 500, samples: 10, warmup: 3 },
	);

	for (const sheet of sheets) {
		dispose(sheet);
	}
});

test("group and subtree lifecycle hot paths", async () => {
	const visible = new Signal.State(true);
	const root = document.createElement("main");
	const templates = Array.from({ length: 100 }, (_value, index) => html("span", attrs({ "data-index": index })));

	await benchmark(
		"signal-dom/group-create-dispose-100-nodes",
		() => {
			const groupRoot = document.createElement("main");
			const groupPlaceholder = group(true, ...templates)(groupRoot);

			dispose(groupPlaceholder);
			_sink = groupRoot;
		},
		{ iterations: 500, samples: 10, warmup: 3 },
	);

	const placeholder = group(visible, ...templates)(root);
	let nextVisibility = true;

	await benchmark(
		"signal-dom/group-toggle-100-nodes",
		async () => {
			visible.set((nextVisibility = !nextVisibility));
			await microtask();
		},
		{ iterations: 500, samples: 10, warmup: 3 },
	);

	visible.set(false);
	await microtask();
	expect(root.children).toHaveLength(0);
	visible.set(true);
	await microtask();
	expect(root.children).toHaveLength(100);

	dispose(placeholder);

	const state = new Signal.State(0);
	const treeTemplate = html(
		"section",
		...Array.from({ length: 100 }, () => html("div", attrs({ title: state }), text(state))),
	);

	await benchmark(
		"signal-dom/reactive-tree-create-dispose-100-nodes",
		() => {
			const tree = treeTemplate();

			dispose(tree);
			_sink = tree;
		},
		{ iterations: 100, samples: 10, warmup: 3 },
	);
});
