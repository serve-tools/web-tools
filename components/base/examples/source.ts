/// <reference path="./env.d.ts" />

import styles from "./gallery.css?raw";
import markup from "./index.html?raw";

const scripts = import.meta.glob<string>(
	[
		"./main.ts",
		"./counter.ts",
		"./forms.ts",
		"./text-fields.ts",
		"./foundations.ts",
		"./integrations.ts",
		"./selection.ts",
		"./menus.ts",
		"./surfaces.ts",
		"./calendar-and-files.ts",
	],
	{ query: "?raw", import: "default", eager: true },
);
const implementations = import.meta.glob<string>("../src/*.ts", { query: "?raw", import: "default", eager: true });
const main = scripts["./main.ts"];
const imports = new Map<string, string>();
for (const match of main.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+"([^"]+)"/g)) {
	for (const name of match[1]
		.split(",")
		.map((name) => name.trim())
		.filter(Boolean)) {
		imports.set(name, match[2]);
	}
}
const registrations = [...main.matchAll(/customElements\.define\("([^"]+)", (\w+)\);/g)];
const behaviors: Record<string, string> = {
	input: "text-fields",
	field: "forms",
	"number-field": "forms",
	"otp-field": "forms",
	slider: "forms",
	autocomplete: "selection",
	combobox: "selection",
	select: "selection",
	menu: "menus",
	"context-menu": "menus",
	menubar: "menus",
	"navigation-menu": "menus",
	toolbar: "menus",
	drawer: "surfaces",
	toast: "surfaces",
	"scroll-area": "surfaces",
	calendar: "calendar-and-files",
	file: "calendar-and-files",
	base: "counter",
	context: "integrations",
	"drag-drop": "integrations",
	internals: "foundations",
	"form-associated": "foundations",
};

interface SourceFile {
	name: string;
	code: string;
	path: string;
	line?: number;
	note: string;
}

const dedent = (text: string): string => {
	const lines = text.trim().split("\n");
	const indentation = Math.min(
		...lines
			.slice(1)
			.filter((line) => line.trim())
			.map((line) => /^\s*/.exec(line)![0].length),
	);
	return lines.map((line, index) => (index ? line.slice(indentation) : line)).join("\n");
};

/** Shows authored source captured before custom elements upgrade or examples change their DOM. */
export function initializeSource(section: HTMLElement): void {
	const preview = section.querySelector<HTMLElement>(".preview")!;
	const details = section.querySelector<HTMLDetailsElement>("details.source")!;
	const code = details.querySelector<HTMLElement>("pre code")!;
	const id = section.dataset.component!;
	const tags = new Set([...preview.querySelectorAll("*")].map((element) => element.localName));
	const used = registrations.filter((match) => tags.has(match[1]));
	const dependencies = new Map<string, string[]>();
	for (const match of used) {
		const origin = imports.get(match[2]);
		if (!origin) {
			throw new Error(`Missing demo import for ${match[2]}`);
		}
		const names = dependencies.get(origin) ?? [];
		names.push(match[2]);
		dependencies.set(origin, names);
	}
	const setup = [
		...(used.length ? ['import "@serve-tools/polyfill-resource-management/apply/DisposableStack";'] : []),
		...[...dependencies].map(([origin, names]) => `import { ${names.join(", ")} } from "${origin}";`),
		"",
		...used.map((match) => match[0]),
	]
		.join("\n")
		.trim();
	const sectionStart = markup.lastIndexOf("<section", markup.indexOf(`data-component="${id}"`));
	const sectionLine = markup.slice(0, sectionStart).split("\n").length;
	const files: SourceFile[] = [
		{
			name: "HTML",
			code: dedent(preview.innerHTML),
			path: "examples/index.html",
			line: sectionLine,
			note: "Authored preview markup, captured before component initialization.",
		},
		{
			name: "Setup",
			code: setup || "// Native HTML: no custom-element registration is needed.",
			path: "examples/main.ts",
			note: "Imports and registrations used by this preview. Local classes are shown in the example files.",
		},
	];
	const exampleFiles = new Set([
		...(behaviors[id] ? [behaviors[id]] : []),
		...[...dependencies.keys()].filter((path) => path.startsWith("./")).map((path) => path.slice(2, -3)),
		"main",
	]);
	for (const name of exampleFiles) {
		files.push({
			name: `${name}.ts`,
			code: scripts[`./${name}.ts`],
			path: `examples/${name}.ts`,
			note:
				name === "main"
					? "Gallery entrypoint and shared example wiring. Other example files contain the relevant component behavior."
					: "Live example source. This file may also wire related previews in the gallery.",
		});
	}
	files.push({
		name: "CSS",
		code: styles,
		path: "examples/gallery.css",
		note: "Shared gallery stylesheet. Base components themselves are unstyled.",
	});
	for (const match of used) {
		const source = implementations[`../src/${match[2]}.ts`];
		if (source) {
			files.push({
				name: match[2],
				code: source,
				path: `src/${match[2]}.ts`,
				note: "Current component implementation. The example files show how to consume it.",
			});
		}
	}

	details.querySelector("summary")!.textContent = "Code and source files";
	const toolbar = document.createElement("div");
	toolbar.className = "source-toolbar";
	const label = document.createElement("label");
	label.textContent = "Source file";
	const select = document.createElement("select");
	select.setAttribute("aria-label", `${section.querySelector("h2")!.textContent} source file`);
	for (const [index, file] of files.entries()) {
		select.add(new Option(file.name, String(index)));
	}
	label.append(select);
	const copy = document.createElement("button");
	copy.type = "button";
	copy.textContent = "Copy code";
	const editor = document.createElement("a");
	editor.textContent = "Open in VS Code";
	const root = typeof __BASE_GALLERY_ROOT__ === "string" ? __BASE_GALLERY_ROOT__ : "";
	editor.hidden = !root;
	const download = document.createElement("a");
	download.textContent = "Download source";
	const status = document.createElement("span");
	status.setAttribute("role", "status");
	const note = document.createElement("p");
	note.className = "source-note";
	toolbar.append(label, copy, editor, download, status);
	details.querySelector("summary")!.after(toolbar, note);

	const render = (): void => {
		const file = files[Number(select.value)];
		code.textContent = file.code;
		note.textContent = file.note;
		status.textContent = "";
		editor.href = `vscode://file/${encodeURI((root + file.path).replace(/^\/+/, ""))}:${file.line ?? 1}`;
		download.href = `data:text/plain;charset=utf-8,${encodeURIComponent(file.code)}`;
		download.download = file.name === "Setup" ? "setup.ts" : file.path.split("/").at(-1)!;
	};
	select.addEventListener("change", render);
	copy.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(code.textContent ?? "");
			status.textContent = "Copied";
		} catch {
			const selection = getSelection();
			const range = document.createRange();
			range.selectNodeContents(code);
			selection?.removeAllRanges();
			selection?.addRange(range);
			status.textContent = "Code selected — press Ctrl+C or Command+C to copy.";
		}
	});
	render();
}
