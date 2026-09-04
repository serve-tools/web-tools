import { describe, expect, it } from "vitest";

import { PersistentFragment } from "../src/client-dom-fragment.js";

const caught = (callback: () => void): unknown => {
	try {
		callback();
	} catch (error) {
		return error;
	}

	throw new Error("Expected the callback to throw");
};

describe("PersistentFragment", () => {
	it("recognizes only start boundaries and active hidden storage", () => {
		const root = document.createElement("main");
		const content = document.createElement("section");
		const fragment = new PersistentFragment([content]);

		fragment.insertBefore(root);
		const start = root.firstChild!;
		const end = root.lastChild!;

		expect(PersistentFragment.fromNode(start)).toBe(fragment);
		expect(PersistentFragment.fromNode(end)).toBeUndefined();
		expect(PersistentFragment.fromNode(content)).toBeUndefined();
		expect(PersistentFragment.fromNode(root)).toBeUndefined();

		fragment.hidden = true;
		const parked = content.getRootNode();

		expect(PersistentFragment.fromNode(parked)).toBe(fragment);
		fragment.remove();
		expect(PersistentFragment.fromNode(start)).toBe(fragment);
		expect(PersistentFragment.fromNode(start.getRootNode())).toBeUndefined();

		fragment.hidden = false;
		expect(PersistentFragment.fromNode(parked)).toBeUndefined();
		expect(PersistentFragment.fromNode(start)).toBe(fragment);
	});

	it("rejects cycles through nested hidden regions and their shadow roots before extraction", () => {
		const root = document.createElement("main");
		const host = document.createElement("section");
		const shadow = host.attachShadow({ mode: "open" });
		const inner = new PersistentFragment([host]);
		const middleStorage = document.createDocumentFragment();
		inner.insertBefore(middleStorage);
		const middle = new PersistentFragment([middleStorage]);
		const outerStorage = document.createDocumentFragment();
		middle.insertBefore(outerStorage);
		const outer = new PersistentFragment([outerStorage]);
		outer.insertBefore(root);
		inner.hidden = true;
		middle.hidden = true;

		for (const hidden of [false, true]) {
			outer.hidden = hidden;
			const rootSnapshot = [...root.childNodes];
			const outerSnapshot = outer.nodes;

			for (const destination of [host, shadow, host.parentNode as DocumentFragment]) {
				expect(caught(() => outer.insertBefore(destination))).toMatchObject({ name: "HierarchyRequestError" });
			}
			expect([...root.childNodes]).toEqual(rootSnapshot);
			expect(outer.nodes).toEqual(outerSnapshot);
		}

		outer.hidden = false;
		middle.hidden = false;
		inner.hidden = false;
		expect(root.querySelector("section")).toBe(host);
	});

	it("normalizes untyped hidden assignments without replacing parked storage", () => {
		const content = document.createElement("span");
		const fragment = new PersistentFragment([content]);
		const untyped: { hidden: unknown } = fragment;

		untyped.hidden = "yes";
		const storage = content.parentNode;
		untyped.hidden = 1;
		expect(fragment.hidden).toBe(true);
		expect(content.parentNode).toBe(storage);
		expect(fragment.nodes).toEqual([content]);
		untyped.hidden = 0;
		expect(fragment.hidden).toBe(false);
		expect(fragment.nodes).toEqual([content]);
	});

	it("preserves identity, listeners, and mutable form state across visibility and placement changes", () => {
		const root = document.createElement("main");
		const nextRoot = document.createElement("section");
		const button = document.createElement("button");
		const input = document.createElement("input");
		const fragment = new PersistentFragment([button, input]);
		let clicks = 0;

		button.addEventListener("click", () => ++clicks);
		input.value = "edited";
		input.checked = true;
		fragment.insertBefore(root);
		button.click();
		fragment.hidden = true;

		expect(root.children).toHaveLength(0);
		expect(fragment.nodes).toEqual([button, input]);

		fragment.hidden = false;
		fragment.insertBefore(nextRoot);
		button.click();

		expect(root.childNodes).toHaveLength(0);
		expect([...nextRoot.children]).toEqual([button, input]);
		expect(input.value).toBe("edited");
		expect(input.checked).toBe(true);
		expect(clicks).toBe(2);
	});

	it("keeps an empty normalized region reusable", () => {
		const root = document.createElement("main");
		const fragment = new PersistentFragment();

		expect(fragment.nodes).toEqual([]);
		fragment.insertBefore(root);
		expect(root.childNodes).toHaveLength(2);
		expect([...root.childNodes].every((node) => node.nodeType === Node.COMMENT_NODE)).toBe(true);

		root.normalize();
		fragment.hidden = true;
		fragment.hidden = true;
		fragment.hidden = false;
		fragment.hidden = false;
		fragment.remove();
		fragment.remove();

		expect(root.childNodes).toHaveLength(0);

		fragment.insertBefore(root);
		expect(root.childNodes).toHaveLength(2);
		expect(fragment.nodes).toEqual([]);
	});

	it("lets a nested fragment update while its outer fragment is hidden", () => {
		const root = document.createElement("main");
		const article = document.createElement("article");
		const value = document.createElement("b");
		const inner = new PersistentFragment([value]);
		const outer = new PersistentFragment([article]);

		value.textContent = "value";
		inner.insertBefore(article);
		outer.insertBefore(root);
		outer.hidden = true;
		inner.hidden = true;

		expect(inner.nodes).toEqual([value]);
		expect(article.textContent).toBe("");

		outer.hidden = false;
		expect(root.querySelector("b")).toBeNull();

		inner.hidden = false;
		expect(root.querySelector("b")).toBe(value);

		outer.remove();
		inner.hidden = true;
		inner.hidden = false;
		outer.insertBefore(root);

		expect(root.querySelector("b")).toBe(value);
	});

	it("keeps directly nested boundary regions independently mutable", () => {
		const root = document.createElement("main");
		const nestedContent = document.createElement("span");
		const nestedStorage = document.createDocumentFragment();
		const inner = new PersistentFragment([nestedContent]);

		inner.insertBefore(nestedStorage);

		const outer = new PersistentFragment([nestedStorage]);

		outer.insertBefore(root);
		outer.hidden = true;
		inner.hidden = true;

		expect(inner.nodes).toEqual([nestedContent]);

		outer.hidden = false;
		expect(root.querySelector("span")).toBeNull();

		inner.hidden = false;
		expect(root.querySelector("span")).toBe(nestedContent);

		inner.remove();
		expect(root.querySelector("span")).toBeNull();

		inner.insertBefore(root, root.lastChild);
		expect(root.querySelector("span")).toBe(nestedContent);
		expect(outer.nodes).toEqual([...root.childNodes].slice(1, -1));
	});

	it("captures current top-level DOM edits instead of retaining a stale node list", () => {
		const root = document.createElement("main");
		const original = document.createElement("span");
		const inserted = document.createElement("strong");
		const fragment = new PersistentFragment([original]);

		fragment.insertBefore(root);
		const end = root.lastChild!;
		const firstSnapshot = fragment.nodes;

		end.before(inserted);
		original.remove();

		expect(firstSnapshot).toEqual([original]);
		expect(fragment.nodes).toEqual([inserted]);

		fragment.hidden = true;
		fragment.remove();
		fragment.insertBefore(root);
		fragment.hidden = false;

		expect(fragment.nodes).toEqual([inserted]);
		expect(root.querySelector("strong")).toBe(inserted);
	});

	it("consumes DocumentFragment inputs in native order", () => {
		const input = document.createDocumentFragment();
		const first = document.createTextNode("first");
		const second = document.createElement("span");

		second.textContent = "second";
		input.append(first, second);

		const fragment = new PersistentFragment([input]);
		const root = document.createElement("main");

		expect(input.childNodes).toHaveLength(0);
		expect(fragment.nodes).toEqual([first, second]);

		fragment.insertBefore(root);
		expect(root.textContent).toBe("firstsecond");
		expect(fragment.nodes).toEqual([first, second]);
	});

	it("snapshots a live NodeList before consuming its nodes", () => {
		const source = document.createElement("div");
		const first = document.createTextNode("first");
		const second = document.createElement("span");
		const third = document.createTextNode("third");

		source.append(first, second, third);

		const fragment = new PersistentFragment(source.childNodes);

		expect(source.childNodes).toHaveLength(0);
		expect(fragment.nodes).toEqual([first, second, third]);
	});

	it("adopts a hidden region from another document and resets range state", () => {
		const alternate = document.implementation.createHTMLDocument("alternate");
		const node = alternate.createElement("span");
		const fragment = new PersistentFragment([node], alternate);
		const root = document.createElement("main");

		fragment.hidden = true;
		fragment.insertBefore(root);
		fragment.hidden = false;

		expect(node.ownerDocument).toBe(document);
		expect(root.querySelector("span")).toBe(node);

		fragment.hidden = true;
		fragment.hidden = false;
		fragment.remove();
		fragment.insertBefore(root);

		expect(fragment.nodes).toEqual([node]);
		expect(root.querySelector("span")).toBe(node);
	});

	it("moves through a shadow root and detached DocumentFragment", () => {
		const host = document.createElement("div");
		const shadow = host.attachShadow({ mode: "open" });
		const storage = document.createDocumentFragment();
		const node = document.createElement("span");
		const fragment = new PersistentFragment([node]);

		fragment.insertBefore(shadow);
		expect(shadow.querySelector("span")).toBe(node);

		fragment.hidden = true;
		fragment.insertBefore(storage);
		expect(shadow.childNodes).toHaveLength(0);
		expect(storage.childNodes).toHaveLength(2);

		fragment.hidden = false;
		expect(storage.querySelector("span")).toBe(node);
		fragment.insertBefore(shadow);

		expect(storage.childNodes).toHaveLength(0);
		expect(shadow.querySelector("span")).toBe(node);
	});

	it("preserves sibling order through moves and repeated no-op operations", () => {
		const root = document.createElement("main");
		const before = document.createElement("i");
		const content = document.createElement("span");
		const after = document.createElement("b");
		const fragment = new PersistentFragment([content]);

		before.id = "before";
		content.id = "content";
		after.id = "after";
		root.append(before, after);
		fragment.insertBefore(root, after);

		expect([...root.children].map((node) => node.id)).toEqual(["before", "content", "after"]);

		fragment.insertBefore(root, after);
		fragment.hidden = false;
		fragment.insertBefore(root, root.firstChild);

		expect([...root.children].map((node) => node.id)).toEqual(["content", "before", "after"]);

		fragment.remove();
		fragment.remove();
		fragment.insertBefore(root);
		fragment.insertBefore(root);

		expect([...root.children].map((node) => node.id)).toEqual(["before", "after", "content"]);
	});

	it("rejects invalid references and destinations without detaching the region", () => {
		const root = document.createElement("main");
		const other = document.createElement("aside");
		const content = document.createElement("section");
		const child = document.createElement("span");
		const shadow = content.attachShadow({ mode: "open" });
		const fragment = new PersistentFragment([content]);

		content.append(child);
		fragment.insertBefore(root);

		expect(caught(() => fragment.insertBefore(other, root))).toMatchObject({ name: "NotFoundError" });
		expect(caught(() => fragment.insertBefore(content))).toMatchObject({ name: "HierarchyRequestError" });
		expect(caught(() => fragment.insertBefore(root, content))).toMatchObject({ name: "HierarchyRequestError" });
		expect(root.querySelector("section")).toBe(content);
		expect(fragment.nodes).toEqual([content]);

		fragment.hidden = true;

		const hiddenRoot = [...root.childNodes];
		const parked = fragment.nodes[0]!.parentNode as DocumentFragment;

		expect(caught(() => fragment.insertBefore(shadow))).toMatchObject({ name: "HierarchyRequestError" });
		expect(caught(() => fragment.insertBefore(parked))).toMatchObject({ name: "HierarchyRequestError" });
		expect([...root.childNodes]).toEqual(hiddenRoot);
		expect(fragment.hidden).toBe(true);
		expect(fragment.nodes).toEqual([content]);
	});

	it("reports externally corrupted boundaries as InvalidStateError without capturing siblings", () => {
		const root = document.createElement("main");
		const content = document.createElement("span");
		const sibling = document.createElement("b");
		const fragment = new PersistentFragment([content]);

		fragment.insertBefore(root);
		root.append(sibling, root.firstChild!);
		const snapshot = [...root.childNodes];

		expect(caught(() => (fragment.hidden = true))).toMatchObject({ name: "InvalidStateError" });
		expect([...root.childNodes]).toEqual(snapshot);
		expect(root.querySelector("span")).toBe(content);
		expect(root.querySelector("b")).toBe(sibling);
	});

	it("rejects synchronous custom-element reentry without losing the region", () => {
		const root = document.createElement("main");
		const name = `x-persistent-fragment-${crypto.randomUUID()}`;
		let fragment: PersistentFragment;
		let reenter: "hide" | "insert" = "hide";
		const errors: unknown[] = [];

		customElements.define(
			name,
			class extends HTMLElement {
				connectedCallback(): void {
					if (reenter !== "hide") {
						return;
					}
					try {
						fragment.hidden = true;
					} catch (error) {
						errors.push(error);
					}
				}

				disconnectedCallback(): void {
					if (reenter !== "insert") {
						return;
					}
					try {
						fragment.insertBefore(root);
					} catch (error) {
						errors.push(error);
					}
				}
			},
		);

		const element = document.createElement(name);
		fragment = new PersistentFragment([element]);
		document.body.append(root);

		try {
			fragment.insertBefore(root);
			expect(root.querySelector(name)).toBe(element);

			reenter = "insert";
			fragment.remove();
			expect(root.querySelector(name)).toBeNull();
			expect(fragment.nodes).toEqual([element]);

			reenter = "hide";
			fragment.insertBefore(root);

			expect(errors).toHaveLength(3);
			expect(errors).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: "InvalidStateError" }),
					expect.objectContaining({ name: "InvalidStateError" }),
					expect.objectContaining({ name: "InvalidStateError" }),
				]),
			);
			expect(root.querySelector(name)).toBe(element);
			expect(fragment.hidden).toBe(false);
		} finally {
			root.remove();
		}
	});

	it("registers hidden storage before callbacks and rejects partial nodes reads", () => {
		const root = document.createElement("main");
		const name = `x-persistent-fragment-read-${crypto.randomUUID()}`;
		let fragment: PersistentFragment;
		let hiding = false;
		const errors: unknown[] = [];
		const owners: (PersistentFragment | undefined)[] = [];

		customElements.define(
			name,
			class extends HTMLElement {
				disconnectedCallback(): void {
					if (!hiding) {
						return;
					}
					owners.push(PersistentFragment.fromNode(this.getRootNode()));
					errors.push(caught(() => fragment.nodes));
				}
			},
		);
		const first = document.createElement(name);
		const second = document.createElement(name);
		fragment = new PersistentFragment([first, second]);
		document.body.append(root);

		try {
			fragment.insertBefore(root);
			hiding = true;
			fragment.hidden = true;
			hiding = false;

			expect(owners).toEqual([fragment, fragment]);
			expect(errors).toEqual([
				expect.objectContaining({ name: "InvalidStateError" }),
				expect.objectContaining({ name: "InvalidStateError" }),
			]);
			expect(fragment.nodes).toEqual([first, second]);
		} finally {
			root.remove();
		}
	});
});
