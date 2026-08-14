import type { StorageChange, StorageKey, StorageValue } from "../src/client-storage.js";
import { Storage } from "../src/client-storage.js";

interface AppStorage {
	theme: "light" | "dark";
	token: string;
}

const storage = new Storage<AppStorage>("local", window);
const theme: "light" | "dark" | null = storage.get("theme");
const size: number = storage.size;
const key: StorageKey<AppStorage> = "token";
const value: StorageValue<AppStorage, "theme"> = "dark";

storage.set("theme", "light");
storage.set("token", null);
storage.subscribe("theme", (change: StorageChange<"theme", "light" | "dark">) => {
	if (change.kind === "updated") {
		const current: "light" | "dark" = change.value;
		const previous: "light" | "dark" = change.previous;

		void current;
		void previous;
	}
});

// @ts-expect-error unknown storage key
storage.get("missing");
// @ts-expect-error value does not match the key's schema
storage.set("theme", "system");
// @ts-expect-error Signal-based watching is intentionally not part of the API
storage.watch("theme");

void theme;
void size;
void key;
void value;
