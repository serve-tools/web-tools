# Recipe: quick start

This public-import example is generated from the compile-checked `test/signals.recipes.ts` fixture in the package source.

```ts
import { createEffect, effect, Signal, SignalArray } from "@serve-tools/signals";
import { SignalArray as FocusedSignalArray } from "@serve-tools/signals/collections";
import { createEffect as focusedCreateEffect } from "@serve-tools/signals/effect";
import { Signal as FocusedSignal } from "@serve-tools/signals/signal";

const count = new Signal.State(0);
const items = new SignalArray<string>();
const dispose = effect(() => count.get());
const controller = createEffect(() => items.length);
const sameSignal: typeof Signal = FocusedSignal;
const sameSignalArray: typeof SignalArray = FocusedSignalArray;
const sameCreateEffect: typeof createEffect = focusedCreateEffect;

void dispose;
void controller;
void sameSignal;
void sameSignalArray;
void sameCreateEffect;
```
