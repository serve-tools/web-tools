import { context, keyboard, storage } from "../src/client.js";

const theme = context.createContext<"dark" | "light">(Symbol("theme"));
const provider = new context.ContextProvider(document.body, { context: theme, initialValue: "light" });
const preferences = new storage.Storage<{ theme: "dark" | "light" }>();

provider.connect();
provider.setValue(preferences.get("theme") ?? "light");

window.addEventListener("keydown", (event) => {
	if (keyboard.matchKeyChord("Mod+K", event)) event.preventDefault();
});
