import { expect, test } from "vitest";

import { benchmark } from "../../benchmark.js";
import { getKeyChord } from "../src/lib/keyboard.js";

test("keyboard chord hot path", async () => {
	const event = {
		key: "k",
		keyCode: 75,
		altKey: true,
		ctrlKey: true,
		metaKey: true,
		shiftKey: true,
		isComposing: false,
		getModifierState: () => false,
	} as unknown as KeyboardEvent;
	let chord = "";

	await benchmark(
		"client-keyboard/get-key-chord",
		() => {
			chord = getKeyChord(event);
		},
		{ iterations: 1_000_000 },
	);

	expect(chord).toBe("Mod+Aux+Alt+Shift+K");
});
