/// <reference lib="dom" />

import type { KeyChord } from "@serve-tools/client-keyboard";
import {
	getKeyChord,
	getKeyChordAriaKeyShortcuts,
	getKeyChordLabel,
	getKeyChordSymbols,
	isApplePlatform,
	matchKeyChord,
} from "@serve-tools/client-keyboard";

const query = <ElementType extends Element>(selector: string): ElementType => {
	const element = document.querySelector<ElementType>(selector);

	if (!element) throw new Error(`Missing demo element: ${selector}`);

	return element;
};

const capture = query<HTMLElement>("#capture");
const symbols = query<HTMLElement>("#symbols");
const label = query<HTMLElement>("#label");
const canonical = query<HTMLElement>("#canonical");
const aria = query<HTMLElement>("#aria");
const shortcuts = ["Mod+K", "Mod+Shift+P", "Alt+ArrowDown"] as const satisfies readonly KeyChord[];

for (const chord of shortcuts) {
	const item = document.createElement("li");
	const visual = document.createElement("span");
	const description = document.createElement("span");

	visual.className = "shortcut-symbols";
	visual.replaceChildren(...getKeyChordSymbols(chord).map(createKey));
	description.textContent = getKeyChordLabel(chord);
	item.dataset.chord = chord;
	item.append(visual, description);
	query("#shortcuts").append(item);
}

capture.addEventListener("keydown", (event) => {
	const chord = getKeyChord(event);

	if (!chord) return;
	if (shortcuts.some((expected) => matchKeyChord(expected, event))) event.preventDefault();

	symbols.replaceChildren(...getKeyChordSymbols(chord).map(createKey));
	label.textContent = getKeyChordLabel(chord);
	canonical.textContent = chord;
	aria.textContent = getKeyChordAriaKeyShortcuts(chord);

	for (const item of document.querySelectorAll<HTMLElement>("[data-chord]")) {
		item.toggleAttribute("data-matched", item.dataset.chord === chord);
	}
});

capture.dataset.platform = isApplePlatform ? "Apple" : "Control-based";
capture.focus();

function createKey(value: string): HTMLElement {
	return Object.assign(document.createElement("kbd"), { textContent: value });
}
