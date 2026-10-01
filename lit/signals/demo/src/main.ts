import "./code-example.js";
import "./examples/collections.js";
import collectionsSource from "./examples/collections.ts?raw";
import "./examples/context.js";
import contextSource from "./examples/context.ts?raw";
import "./examples/counter.js";
import counterSource from "./examples/counter.ts?raw";
import "./examples/operation.js";
import operationSource from "./examples/operation.ts?raw";
import "./examples/styles.js";

import type { CodeExampleElement } from "./code-example.js";
import stylesSource from "./examples/styles.ts?raw";

const lines = (...value: string[]) => value.join("\n");
const substitution = "$" + "{";
const examples = new Map<string, { snippet: string; source: string }>([
	[
		"counter-example",
		{
			source: counterSource,
			snippet: lines(
				"readonly #count = new Signal.State(0);",
				"",
				"return html`",
				`\t<strong class="value">${substitution}this.#count}</strong>`,
				`\t${substitution}when(`,
				"\t\t() => this.#count.get() === 0,",
				"\t\t() => html`<p>Start the counter.</p>`,",
				"\t)}",
				`\t<button @click=${substitution}() => this.#count.set(this.#count.get() + 1)}>Increment</button>`,
				"`;",
			),
		},
	],
	[
		"collections-example",
		{
			source: collectionsSource,
			snippet: lines(
				"@collection(SignalArray)",
				"accessor tasks: Task[] = [];",
				"",
				"return html`" + substitution + "repeat(",
				"\t() => this.tasks,",
				"\t(task) => task.id,",
				"\t(task) => html`<li>" + substitution + "task.title}</li>`,",
				")}`;",
				"",
				'this.tasks.push({ done: false, id: 1, title: "Learn Signals" });',
			),
		},
	],
	[
		"context-example",
		{
			source: contextSource,
			snippet: lines(
				'const themeContext = createContext<Theme>(Symbol("theme"));',
				"",
				"class Provider extends SignalElement {",
				"\t@provide({ context: themeContext }) accessor theme = themes[0]!;",
				"}",
				"",
				"class Consumer extends SignalElement {",
				"\t@consume({ context: themeContext, subscribe: true }) accessor theme = fallbackTheme;",
				"\tprotected render() {",
				"\t\treturn html`<p>" + substitution + "watch(() => this.theme.name)}</p>`;",
				"\t}",
				"}",
			),
		},
	],
	[
		"operation-example",
		{
			source: operationSource,
			snippet: lines(
				"const progress = new AsyncOperationSubscriber<number>();",
				"",
				"class Progress extends SignalElement {",
				"\t@operation(progress.map((value) => `" + substitution + 'value}%`)) accessor value = "Starting…";',
				"\tprotected render() {",
				"\t\treturn html`<output>" + substitution + "this.value}</output>`;",
				"\t}",
				"}",
				"",
				"progress.consume(new AsyncOperation(async (write) => write(100)));",
			),
		},
	],
	[
		"styles-example",
		{
			source: stylesSource,
			snippet: lines(
				"@property() accessor hue = 265;",
				"@computed get accent() {",
				"\treturn `hsl(" + substitution + "this.hue} 62% 52%)`;",
				"}",
				'@style accessor hostStyle = { "--accent": () => this.accent };',
				"",
				"return html`",
				'\t<div class="swatch">' + substitution + "watch(() => this.accent)}</div>",
				'\t<input type="range" @input=' +
					substitution +
					"(event) => (this.hue = event.currentTarget.valueAsNumber)} />",
				"`;",
			),
		},
	],
]);

for (const [id, { snippet, source }] of examples) {
	const example = document.querySelector<CodeExampleElement>(`#${id}`);

	if (!example) {
		throw new Error(`Missing demo example: ${id}`);
	}

	example.snippet = snippet;
	example.source = source;
}
