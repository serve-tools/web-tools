# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-storage.recipes.ts` fixture in the package source.

```ts
import { SignalStorage } from "@serve-tools/signal-storage";

interface Preferences {
	theme: "dark" | "light";
}

const storage = new SignalStorage<Preferences>();
const theme = storage.watch("theme");

storage.set("theme", "dark");

const state = theme.get();

document.documentElement.dataset.theme = state ?? "light";

theme.dispose();
```
