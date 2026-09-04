import { PersistentFragment } from "../src/client-dom-fragment.js";

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
