# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-dom.recipes.ts` fixture in the package source.

```ts
import { Signal } from "@serve-tools/signal";
import { attrs, createBindingScope, html, text } from "@serve-tools/signal-dom";

const count = new Signal.State(0);
const label = new Signal.Computed(() => `Count: ${count.get()}`);
const button = html("button", attrs({ title: label }), text(label))();

button.addEventListener("click", () => count.set(count.get() + 1));
document.body.append(button);

const scope = createBindingScope();
const content = document.createDocumentFragment();
const status = new Signal.State("Ready");
const output = scope.capture(() => html("output", text(status))(content));

document.body.append(content);
scope.resume();

scope.suspend();
status.set("Current");
scope.resume();

void output;
```
