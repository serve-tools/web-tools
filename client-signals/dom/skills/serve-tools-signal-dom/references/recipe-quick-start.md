# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-dom.recipes.ts` fixture in the package source.

```ts
import { Signal } from "@serve-tools/signal";
import { attrs, createBindingScope, html, text } from "@serve-tools/signal-dom";
import { createFragment, html as templateHtml } from "@serve-tools/signal-dom/template";

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

const templateScope = createBindingScope();
const view = templateScope.capture(() => createFragment(templateHtml`<output>${status}</output>`, {}));
document.body.append(view);
templateScope.resume();
templateScope.suspend();
status.set("Latest");
templateScope.resume();
templateScope.dispose(); // Also retires this view's listeners and directives, without removing DOM.

const persistent = createFragment(templateHtml`<span>${status}</span>`, {});
document.body.append(persistent);
persistent.dispose(); // Persistent observation always needs explicit retirement.
```
