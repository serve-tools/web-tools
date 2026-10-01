/// <reference path="./env.d.ts" />

import markup from "./template.html?raw";
import source from "./template.ts?raw";

const files = [
	{ name: "template.html", code: markup, path: "examples/template.html" },
	{ name: "template.ts", code: source, path: "examples/template.ts" },
];
const select = document.querySelector<HTMLSelectElement>("#template-source-file")!;
const code = document.querySelector<HTMLElement>("#template-source-code")!;
const copy = document.querySelector<HTMLButtonElement>("#template-source-copy")!;
const editor = document.querySelector<HTMLAnchorElement>("#template-source-editor")!;
const download = document.querySelector<HTMLAnchorElement>("#template-source-download")!;
const status = document.querySelector<HTMLElement>("#template-source-status")!;
const root = typeof __BASE_GALLERY_ROOT__ === "string" ? __BASE_GALLERY_ROOT__ : "";

for (const [index, file] of files.entries()) {
	select.add(new Option(file.name, String(index)));
}
editor.hidden = !root;

const render = (): void => {
	const file = files[Number(select.value)]!;
	code.textContent = file.code;
	editor.href = `vscode://file/${encodeURI((root + file.path).replace(/^\/+/, ""))}:1`;
	download.href = `data:text/plain;charset=utf-8,${encodeURIComponent(file.code)}`;
	download.download = file.name;
	status.textContent = "";
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
