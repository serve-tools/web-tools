import { Storage } from "../src/client-storage.js";

interface Preferences {
	colorScheme: "light" | "dark";
	reducedMotion: "reduce" | "no-preference";
}

/** A compile-tested observation and cancellation recipe. */
export function storageRecipe(signal: AbortSignal): Storage<Preferences> {
	const preferences = new Storage<Preferences>();

	preferences.subscribe(
		"colorScheme",
		(change) => {
			const value =
				change.kind === "removed" || change.kind === "invalidated" ? preferences.get(change.key) : change.value;

			console.log(value);
		},
		{ signal },
	);

	preferences.set("colorScheme", "dark");

	return preferences;
}
