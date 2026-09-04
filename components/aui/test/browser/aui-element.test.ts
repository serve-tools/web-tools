import { Signal } from "@serve-tools/signal";
import { group, html, props, text } from "@serve-tools/signal-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AUIElement } from "../../src/aui-element.js";

const fixtures: Element[] = [];
const microtask = () => new Promise<void>(queueMicrotask);

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const create = <T extends AUIElement>(constructor: new () => T): T => {
	const name = `aui-test-${crypto.randomUUID()}`;
	customElements.define(name, constructor);
	const element = document.createElement(name) as T;
	fixtures.push(element);
	return element;
};

describe("AUIElement", () => {
	test("mounts once after fields exist and releases external signal sinks synchronously", async () => {
		const value = new Signal.State("before");
		let mounts = 0;
		let starts = 0;
		let stops = 0;

		class Element extends AUIElement {
			field = "ready";

			protected layout(content: DocumentFragment): void {
				expect(this.field).toBe("ready");
				++mounts;
				html("span", text(value))(content);
			}

			protected connect(connection: AUIElement.Connection): void {
				++starts;
				connection.addCleanup(() => ++stops);
			}
		}

		const element = create(Element);
		expect(mounts).toBe(0);
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		document.body.append(element);
		const node = element.firstChild;
		expect(element.textContent).toBe("before");
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);

		value.set("queued");
		element.remove();
		expect(stops).toBe(1);
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		value.set("detached");
		await microtask();
		expect(element.textContent).toBe("before");

		document.body.append(element);
		expect(element.firstChild).toBe(node);
		expect(element.textContent).toBe("detached");
		expect(mounts).toBe(1);
		expect(starts).toBe(2);
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);
	});

	test("reconciles unchanged signal values after detached DOM edits", () => {
		const value = new Signal.State("owned");
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					html("span", text(value))(content);
				}
			},
		);

		document.body.append(element);
		const textNode = element.firstChild!.firstChild!;
		element.remove();
		textNode.textContent = "changed outside the binding";
		document.body.append(element);
		expect(element.firstChild!.firstChild).toBe(textNode);
		expect(textNode.textContent).toBe("owned");
	});

	test("does not accumulate listeners or bindings over repeated connections", () => {
		const value = new Signal.State(0);
		let events = 0;
		let cleanupCount = 0;
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					text(value)(content);
				}

				protected connect(connection: AUIElement.Connection): () => void {
					this.ownerDocument.addEventListener("aui-test-event", () => ++events, {
						signal: connection.signal,
					});
					return () => ++cleanupCount;
				}
			},
		);

		for (let index = 0; index < 100; ++index) {
			document.body.append(element);
			document.dispatchEvent(new Event("aui-test-event"));
			element.remove();
			document.dispatchEvent(new Event("aui-test-event"));
			expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		}

		expect(events).toBe(100);
		expect(cleanupCount).toBe(100);
	});

	test("retains hidden group nodes and stops their bindings with the host", async () => {
		const visible = new Signal.State(true);
		const value = new Signal.State("first");
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					group(visible, html("span", text(value)))(content);
				}
			},
		);

		document.body.append(element);
		const node = element.querySelector("span");
		visible.set(false);
		await microtask();
		expect(element.querySelector("span")).toBeNull();
		element.remove();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		expect(Signal.subtle.introspectSinks(visible)).toHaveLength(0);
		document.body.append(element);
		expect(element.querySelector("span")).toBeNull();
		element.remove();
		value.set("latest");
		visible.set(true);
		document.body.append(element);
		expect(element.querySelector("span")).toBe(node);
		expect(node?.textContent).toBe("latest");
	});

	test("owns closed shadow bindings without touching author-provided light DOM", () => {
		const value = new Signal.State("shadow");
		let closedRoot: ShadowRoot;
		const element = create(
			class extends AUIElement {
				protected createLayoutRoot(): ShadowRoot {
					return (closedRoot = this.attachShadow({ mode: "closed" }));
				}

				protected layout(content: DocumentFragment): void {
					html("span", text(value))(content);
					html("slot")(content);
				}
			},
		);
		const authored = document.createElement("input");
		authored.value = "author state";
		element.append(authored);
		document.body.append(element);
		const node = closedRoot!.firstChild;
		element.remove();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		document.body.append(element);
		expect(element.shadowRoot).toBeNull();
		expect(closedRoot!.firstChild).toBe(node);
		expect(element.firstChild).toBe(authored);
		expect(authored.value).toBe("author state");
	});

	test("keeps nested component scopes independent", () => {
		const parentValue = new Signal.State("parent");
		const childValue = new Signal.State("child");
		const child = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					text(childValue)(content);
				}
			},
		);
		const parent = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					text(parentValue)(content);
					content.append(child);
				}
			},
		);

		document.body.append(parent);
		expect(Signal.subtle.introspectSinks(childValue)).toHaveLength(1);
		document.body.append(child);
		parent.remove();
		expect(Signal.subtle.introspectSinks(parentValue)).toHaveLength(0);
		expect(Signal.subtle.introspectSinks(childValue)).toHaveLength(1);
		child.remove();
		expect(Signal.subtle.introspectSinks(childValue)).toHaveLength(0);
	});

	test("stops resources registered before setup removes the host", async () => {
		let starts = 0;
		const cleanups: number[] = [];
		const element = create(
			class extends AUIElement {
				protected connect(connection: AUIElement.Connection): () => void {
					++starts;
					connection.addCleanup(() => cleanups.push(1));
					this.remove();
					connection.addCleanup(() => cleanups.push(2));
					return () => cleanups.push(3);
				}
			},
		);

		document.body.append(element);
		await microtask();
		expect(element.isConnected).toBe(false);
		expect(starts).toBe(1);
		expect(cleanups).toEqual([1, 2, 3]);
	});

	test("defers reconnection requested inside a queued setter until it unwinds", async () => {
		const value = new Signal.State("first");
		let reinsert = false;
		let setterDepth = 0;
		let maximumDepth = 0;
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					html("span", (node: HTMLSpanElement) => {
						Object.defineProperty(node, "title", {
							set(title: string) {
								maximumDepth = Math.max(maximumDepth, ++setterDepth);
								if (reinsert) {
									reinsert = false;
									element.remove();
									document.body.append(element);
								}
								node.setAttribute("title", title);
								--setterDepth;
							},
						});
						props<HTMLSpanElement>({ title: value })(node);
					})(content);
				}
			},
		);

		document.body.append(element);
		reinsert = true;
		value.set("second");
		await microtask();
		await microtask();
		expect(maximumDepth).toBe(1);
		expect(element.querySelector("span")?.getAttribute("title")).toBe("second");
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);
	});

	test("reacquires listeners from the adopted document without recreating layout", () => {
		const value = new Signal.State("preserved");
		const received: Document[] = [];
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					text(value)(content);
				}

				protected connect(connection: AUIElement.Connection): void {
					const owner = this.ownerDocument;
					owner.addEventListener("aui-test-adoption", () => received.push(owner), {
						signal: connection.signal,
					});
				}
			},
		);
		document.body.append(element);
		const node = element.firstChild;
		const target = document.implementation.createHTMLDocument("adoption");
		target.body.append(target.adoptNode(element));
		document.dispatchEvent(new Event("aui-test-adoption"));
		target.dispatchEvent(new Event("aui-test-adoption"));
		expect(received).toEqual([target]);
		expect(element.firstChild).toBe(node);
		expect(element.ownerDocument).toBe(target);
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);
	});
});
