import { expect, test } from "vitest";

import { getKeyChord } from "../../src/lib/keyboard.js";

test("uses native KeyboardEvent keyCode values before key values", (): void => {
	const event = new KeyboardEvent("keydown", { altKey: true, key: "Dead" });

	Object.defineProperty(event, "keyCode", { value: 90 });

	expect(getKeyChord(event)).toBe("Alt+Z");
});
