# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-keyboard.recipes.ts` fixture in the package source.

```ts
import { getKeyChordAriaKeyShortcuts, getKeyChordLabel, matchKeyChord } from "@serve-tools/client-keyboard";

const shortcut = "Mod+Shift+P" as const;
const button = document.createElement("button");

button.textContent = `Commands (${getKeyChordLabel(shortcut)})`;
button.setAttribute("aria-keyshortcuts", getKeyChordAriaKeyShortcuts(shortcut));

window.addEventListener("keydown", (event) => {
	if (!matchKeyChord(shortcut, event)) return;

	event.preventDefault();
	button.click();
});
```
