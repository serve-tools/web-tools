import { SignalStorage } from "../src/signal-storage.js";

interface Preferences {
	theme: "dark" | "light";
}

const storage = new SignalStorage<Preferences>();
const theme = storage.watch("theme");

storage.set("theme", "dark");

const state = theme.get();

document.documentElement.dataset.theme = state ?? "light";

theme.dispose();
