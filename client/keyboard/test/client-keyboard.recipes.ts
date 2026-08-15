import { getKeyChordAriaKeyShortcuts, getKeyChordLabel, matchKeyChord } from "../src/client-keyboard.js";

const shortcut = "Mod+Shift+P" as const;
const button = document.createElement("button");

button.textContent = `Commands (${getKeyChordLabel(shortcut)})`;
button.setAttribute("aria-keyshortcuts", getKeyChordAriaKeyShortcuts(shortcut));

window.addEventListener("keydown", (event) => {
	if (!matchKeyChord(shortcut, event)) return;

	event.preventDefault();
	button.click();
});
