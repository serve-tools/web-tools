# Recipe: quick start

This public-import example is generated from the compile-checked `test/client.recipes.ts` fixture in the package source.

```ts
import { context, keyboard, storage } from "@serve-tools/client";

const theme = context.createContext<"dark" | "light">(Symbol("theme"));
const provider = new context.ContextProvider(document.body, { context: theme, initialValue: "light" });
const preferences = new storage.Storage<{ theme: "dark" | "light" }>();

provider.connect();
provider.setValue(preferences.get("theme") ?? "light");

window.addEventListener("keydown", (event) => {
	if (keyboard.matchKeyChord("Mod+K", event)) event.preventDefault();
});
```
