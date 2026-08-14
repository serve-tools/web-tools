import "./code-example.js";
import "./examples/collections.js";
import collectionsSource from "./examples/collections.ts?raw";
import "./examples/context.js";
import contextSource from "./examples/context.ts?raw";
import "./examples/counter.js";
import counterSource from "./examples/counter.ts?raw";
import "./examples/styles.js";

import type { CodeExampleElement } from "./code-example.js";
import stylesSource from "./examples/styles.ts?raw";

const sources = new Map<string, string>([
	["counter-example", counterSource],
	["collections-example", collectionsSource],
	["context-example", contextSource],
	["styles-example", stylesSource],
]);

for (const [id, source] of sources) {
	const example = document.querySelector<CodeExampleElement>(`#${id}`);

	if (!example) throw new Error(`Missing demo example: ${id}`);

	example.source = source;
}
