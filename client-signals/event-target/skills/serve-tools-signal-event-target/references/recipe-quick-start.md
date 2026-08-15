# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-event-target.recipes.ts` fixture in the package source.

```ts
/// <reference lib="esnext.disposable" />

import { EventTargetSignal, MatchMediaSignal } from "@serve-tools/signal-event-target";

const controller = new AbortController();
const button = document.createElement("button");
const clicks = new EventTargetSignal(button, "click", () => performance.now(), { signal: controller.signal });
const darkMode = new MatchMediaSignal("(prefers-color-scheme: dark)");

clicks.refresh();
console.log(clicks.get(), darkMode.get());

controller.abort();
clicks.dispose();
darkMode.dispose();
```
