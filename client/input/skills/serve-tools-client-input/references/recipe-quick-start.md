# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-input.recipes.ts` fixture in the package source.

```ts
import { observeDropTarget, observePointer } from "@serve-tools/client-input";

const controller = new AbortController();
const handle = document.createElement("button");
const dropZone = document.createElement("div");

observePointer(
	handle,
	{
		move(state) {
			this.style.translate = `${state.delta.x}px ${state.delta.y}px`;
		},
		end() {
			this.style.removeProperty("translate");
		},
	},
	{ signal: controller.signal },
);

observeDropTarget(dropZone, {
	over(event) {
		if (event.dataTransfer?.types.includes("Files")) {
			event.preventDefault();
		}
	},
	end(state) {
		if (state.reason === "drop") {
			this.dataset.received = "true";
		}
	},
});

controller.abort();
```
