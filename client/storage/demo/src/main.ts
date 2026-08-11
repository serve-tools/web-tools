/// <reference lib="dom" />

import { Storage, type StorageChange } from "@serve-tools/client-storage";

interface DemoStorage {
	note: string;
	theme: "light" | "dark";
}

const local = new Storage<DemoStorage>();
const session = new Storage<DemoStorage>("session");

const query = <ElementType extends Element>(selector: string): ElementType => {
	const element = document.querySelector<ElementType>(selector);

	if (!element) throw new Error(`Missing demo element: ${selector}`);

	return element;
};

const output = query<HTMLOutputElement>("output");
const theme = query<HTMLSelectElement>("#theme");
const note = query<HTMLInputElement>("#note");
const events: string[] = [];

const describe = (area: "local" | "session", change: StorageChange): string => {
	switch (change.kind) {
		case "added":
			return `${area}: added ${change.key} = ${change.value}`;
		case "updated":
			return `${area}: updated ${change.key} from ${change.previous} to ${change.value}`;
		case "removed":
			return `${area}: removed ${change.key} (was ${change.previous})`;
		case "invalidated":
			return `${area}: invalidated ${change.key}; read it again`;
	}
};

const record = (area: "local" | "session", change: StorageChange): void => {
	events.unshift(describe(area, change));
	output.value = events.slice(0, 8).join("\n");
};

const syncTheme = (): void => {
	const value = local.get("theme") ?? "light";

	theme.value = value;
	document.documentElement.dataset.theme = value;
};

const unsubscribers = [
	local.subscribe("theme", (change) => {
		record("local", change);
		syncTheme();
	}),
	session.subscribe("note", (change) => record("session", change)),
];

syncTheme();
note.value = session.get("note") ?? "";

query<HTMLFormElement>("#theme-form").addEventListener("submit", (event) => {
	event.preventDefault();
	local.set("theme", theme.value as DemoStorage["theme"]);
});

query("#delete-theme").addEventListener("click", () => local.delete("theme"));

query<HTMLFormElement>("#note-form").addEventListener("submit", (event) => {
	event.preventDefault();
	session.set("note", note.value);
});

query("#clear-session").addEventListener("click", () => {
	session.clear();
	note.value = "";
});

addEventListener(
	"pagehide",
	() => {
		for (const unsubscribe of unsubscribers) unsubscribe();
	},
	{ once: true },
);
