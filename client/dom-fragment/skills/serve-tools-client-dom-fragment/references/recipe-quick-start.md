# Recipe: quick start

This public-import example is generated from the compile-checked `test/fragment.recipes.ts` fixture in the package source.

```ts
import { PersistentFragment } from "@serve-tools/client-dom-fragment";

const parent = document.createElement("section");
const input = document.createElement("input");
const fragment = new PersistentFragment([document.createTextNode("Name: "), input]);

fragment.insertBefore(parent);
fragment.hidden = true;
input.value = "Preserved while hidden";
fragment.hidden = false;

const sameInput = fragment.nodes[1];
if (sameInput !== input) {
	throw new Error("Expected the original input");
}

fragment.remove();
fragment.insertBefore(parent);

const recognized: PersistentFragment | undefined = PersistentFragment.fromNode(parent.firstChild!);
if (recognized !== fragment || PersistentFragment.fromNode(input) !== undefined) {
	throw new Error("Only the region's start boundary identifies it");
}
```
