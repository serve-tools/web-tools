# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-effect.recipes.ts` fixture in the package source.

```ts
import { Signal } from "@serve-tools/signal";
import { createEffect, effect } from "@serve-tools/signal-effect";

const count = new Signal.State(0);
const stopLogging = effect(() => console.log(count.get()));
let renderedCount = "";
const deferred = createEffect(() => (renderedCount = String(count.get())));

deferred.start();
count.set(1);

stopLogging();
deferred.dispose();
void renderedCount;
```
