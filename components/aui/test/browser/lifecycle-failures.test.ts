import { Signal } from "@serve-tools/signal";
import { html, props, text } from "@serve-tools/signal-dom";
import { afterEach, expect, test, vi } from "vitest";
import { AUIElement } from "../../src/aui-element.js";
import { html as template } from "../../src/template.js";

const fixtures: Element[] = [];
const microtask = () => new Promise<void>(queueMicrotask);

afterEach(() => {
	vi.restoreAllMocks();
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
});

const create = <T extends AUIElement>(constructor: new () => T): T => {
	const name = `aui-failure-${crypto.randomUUID()}`;
	customElements.define(name, constructor);
	const element = document.createElement(name) as T;
	fixtures.push(element);
	return element;
};

test("layout failure retires bindings and preserves authored children", () => {
	const value = new Signal.State("owned");
	let layouts = 0;
	const failure = new Error("layout failed");
	const element = create(
		class extends AUIElement {
			override connectedCallback(): void {}

			protected layout(content: DocumentFragment): void {
				++layouts;
				text(value)(content);
				throw failure;
			}
		},
	);
	const authored = document.createElement("input");
	authored.value = "keep";
	element.append(authored);
	document.body.append(element);

	expect(() => AUIElement.prototype.connectedCallback.call(element)).toThrow(failure);
	expect(element.childNodes).toHaveLength(1);
	expect(element.firstChild).toBe(authored);
	expect(authored.value).toBe("keep");
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
	AUIElement.prototype.connectedCallback.call(element);
	expect(layouts).toBe(1);
});

test("a returned template rolls back nested directive resources when setup fails", () => {
	const cleanup = vi.fn();
	const click = vi.fn();
	const failure = new Error("nested setup failed");
	let button: HTMLButtonElement;
	let layouts = 0;
	const element = create(
		class extends AUIElement {
			override connectedCallback(): void {}

			protected layout() {
				++layouts;

				const child = template`<button @click=${click} ${(element: Element) => {
					button = element as HTMLButtonElement;

					return cleanup;
				}}>child</button>`;

				return template`<section>${child}</section><div ${() => {
					throw failure;
				}}></div>`;
			}
		},
	);
	const authored = document.createElement("input");
	element.append(authored);
	document.body.append(element);

	expect(() => AUIElement.prototype.connectedCallback.call(element)).toThrow(failure);
	expect(cleanup).toHaveBeenCalledOnce();
	button!.click();
	expect(click).not.toHaveBeenCalled();
	expect(element.childNodes).toHaveLength(1);
	expect(element.firstChild).toBe(authored);
	AUIElement.prototype.connectedCallback.call(element);
	expect(layouts).toBe(1);
});

test.each([
	["an asynchronous result", () => Promise.resolve(template`<span>late</span>`)],
	["a non-template value", () => "invalid"],
])("rejects %s from layout", (_name, invalid) => {
	const element = create(
		class extends AUIElement {
			override connectedCallback(): void {}

			protected layout() {
				return invalid() as never;
			}
		},
	);
	document.body.append(element);

	expect(() => AUIElement.prototype.connectedCallback.call(element)).toThrow(
		"AUI layout() must return a TemplateResult or finish synchronously",
	);
	expect(element.childNodes).toHaveLength(0);
});

test("connection failure drains resources and a later connection can retry", () => {
	const value = new Signal.State("ready");
	const cleaned: number[] = [];
	const connections: AUIElement.Connection[] = [];
	let fail = true;
	const element = create(
		class extends AUIElement {
			override connectedCallback(): void {}

			protected layout(content: DocumentFragment): void {
				text(value)(content);
			}

			protected connect(connection: AUIElement.Connection): void {
				connections.push(connection);
				connection.addCleanup(() => cleaned.push(1));
				connection.addCleanup(() => {
					cleaned.push(2);
					if (fail) {
						throw new Error("cleanup failed");
					}
				});
				if (fail) {
					throw new Error("setup failed");
				}
			}
		},
	);
	document.body.append(element);

	expect(() => AUIElement.prototype.connectedCallback.call(element)).toThrow(AggregateError);
	expect(cleaned).toEqual([2, 1]);
	expect(connections[0].signal.aborted).toBe(true);
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
	const node = element.firstChild;
	fail = false;
	AUIElement.prototype.connectedCallback.call(element);
	expect(connections).toHaveLength(2);
	expect(element.firstChild).toBe(node);
	expect(connections[1].signal.aborted).toBe(false);
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);

	element.remove();
	expect(connections[1].signal.aborted).toBe(true);
	expect(cleaned).toEqual([2, 1, 2, 1]);
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
});

test("cleanup finishes before reentrant insertion starts a new connection", async () => {
	const value = new Signal.State("ready");
	const order: string[] = [];
	let reinsert = true;
	let previous: AUIElement.Connection | undefined;
	const element = create(
		class extends AUIElement {
			protected layout(content: DocumentFragment): void {
				text(value)(content);
			}

			protected connect(connection: AUIElement.Connection): void {
				if (previous) {
					expect(previous.signal.aborted).toBe(true);
				}
				previous = connection;
				order.push("connect");
				connection.addCleanup(() => order.push("last cleanup"));
				connection.addCleanup(() => {
					order.push("first cleanup");
					if (reinsert) {
						reinsert = false;
						document.body.append(this);
						expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
					}
				});
			}
		},
	);
	document.body.append(element);
	element.remove();
	expect(order).toEqual(["connect", "first cleanup", "last cleanup"]);
	expect(element.isConnected).toBe(true);
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
	await microtask();
	expect(order).toEqual(["connect", "first cleanup", "last cleanup", "connect"]);
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);
});

test("a later cleanup removal cancels reentrant insertion", async () => {
	const value = new Signal.State("ready");
	let connections = 0;
	const element = create(
		class extends AUIElement {
			protected layout(content: DocumentFragment): void {
				text(value)(content);
			}

			protected connect(connection: AUIElement.Connection): void {
				++connections;
				connection.addCleanup(() => this.remove());
				connection.addCleanup(() => document.body.append(this));
			}
		},
	);
	document.body.append(element);
	element.remove();
	await microtask();
	expect(element.isConnected).toBe(false);
	expect(connections).toBe(1);
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
});

test("non-convergent activation gets one deferred retry and stops observing", () => {
	const callbacks: (() => void)[] = [];
	vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => callbacks.push(callback));
	const value = new Signal.State("ready");
	let churn = true;
	let depth = 0;
	let maximumDepth = 0;
	const element = create(
		class extends AUIElement {
			protected layout(content: DocumentFragment): void {
				html("span", (node: HTMLSpanElement) => {
					Object.defineProperty(node, "title", {
						set: (title: string) => {
							maximumDepth = Math.max(maximumDepth, ++depth);
							if (churn) {
								this.remove();
								document.body.append(this);
							}
							node.setAttribute("title", title);
							--depth;
						},
					});
					props<HTMLSpanElement>({ title: value })(node);
				})(content);
			}
		},
	);
	document.body.append(element);
	expect(callbacks).toHaveLength(1);
	expect(() => callbacks.shift()!()).toThrow("connectivity repeatedly changed");
	expect(callbacks).toHaveLength(0);
	expect(maximumDepth).toBe(1);
	expect(element.isConnected).toBe(true);
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
	churn = false;
	element.remove();
	document.body.append(element);
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);
});

test("connected moves retain bindings and provide the current resource scope", () => {
	const value = new Signal.State("ready");
	const containers = [document.createElement("div"), document.createElement("div")];
	fixtures.push(...containers);
	document.body.append(...containers);
	let connects = 0;
	let connection: AUIElement.Connection;
	const movedTo: Node[] = [];
	const element = create(
		class extends AUIElement {
			protected layout(content: DocumentFragment): void {
				text(value)(content);
			}

			protected connect(current: AUIElement.Connection): void {
				++connects;
				connection = current;
			}

			protected moved(current: AUIElement.Connection): void {
				expect(current).toBe(connection);
				expect(current.signal.aborted).toBe(false);
				movedTo.push(this.parentNode!);
			}
		},
	);
	containers[0].append(element);
	const node = element.firstChild;
	containers[1].append(element);
	expect(movedTo).toEqual([containers[1]]);
	expect(connects).toBe(1);
	expect(element.firstChild).toBe(node);
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);

	const movable = containers[0] as HTMLElement & { moveBefore?: (node: Node, child: Node | null) => void };
	if (movable.moveBefore) {
		movable.moveBefore(element, null);
		expect(movedTo).toEqual([containers[1], containers[0]]);
		expect(connects).toBe(1);
		expect(element.firstChild).toBe(node);
	}
});

test("an ordinary move during setup refreshes relationships after setup finishes", async () => {
	const containers = [document.createElement("div"), document.createElement("div")];
	fixtures.push(...containers);
	document.body.append(...containers);
	const order: string[] = [];
	let connection: AUIElement.Connection;
	const element = create(
		class extends AUIElement {
			protected connect(current: AUIElement.Connection): void {
				connection = current;
				order.push("setup starts");
				containers[1].append(this);
				order.push("setup ends");
			}

			protected moved(current: AUIElement.Connection): void {
				expect(current).toBe(connection);
				expect(current.signal.aborted).toBe(false);
				order.push("moved");
			}
		},
	);

	containers[0].append(element);
	expect(element.parentNode).toBe(containers[1]);
	expect(order).toEqual(["setup starts", "setup ends"]);

	await microtask();
	expect(order).toEqual(["setup starts", "setup ends", "moved"]);
});

test("a failed topology refresh releases all current resources", () => {
	const value = new Signal.State("ready");
	let connection: AUIElement.Connection;
	let stopped = false;
	const element = create(
		class extends AUIElement {
			protected layout(content: DocumentFragment): void {
				text(value)(content);
			}

			protected connect(current: AUIElement.Connection): void {
				connection = current;
				current.addCleanup(() => (stopped = true));
			}

			protected moved(): void {
				throw new Error("context failed");
			}
		},
	);
	document.body.append(element);
	expect(() => element.connectedMoveCallback()).toThrow("context failed");
	expect(connection!.signal.aborted).toBe(true);
	expect(stopped).toBe(true);
	expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
});

test.each(["explicit adoption", "direct insertion"])(
	"owned style nodes and connection resources follow %s into another window",
	async (method) => {
		const frame = document.createElement("iframe");
		fixtures.push(frame);
		frame.srcdoc = "<!doctype html><body></body>";
		const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
		document.body.append(frame);
		await loaded;
		const target = frame.contentDocument!;
		const received: Document[] = [];
		const connections: AUIElement.Connection[] = [];
		const element = create(
			class extends AUIElement {
				protected createLayoutRoot(): ShadowRoot {
					return this.attachShadow({ mode: "open" });
				}

				protected layout(content: DocumentFragment): void {
					html("style", text("span { color: rgb(12, 34, 56); }"))(content);
					html("span", text("styled"))(content);
				}

				protected connect(connection: AUIElement.Connection): void {
					connections.push(connection);
					const owner = this.ownerDocument;
					owner.addEventListener("aui-adopted", () => received.push(owner), { signal: connection.signal });
				}
			},
		);
		document.body.append(element);
		const node = element.shadowRoot!.querySelector("span")!;
		expect(getComputedStyle(node).color).toBe("rgb(12, 34, 56)");
		target.body.append(method === "explicit adoption" ? target.adoptNode(element) : element);
		expect(connections).toHaveLength(2);
		expect(connections[0]!.signal.aborted).toBe(true);
		expect(connections[1]!.signal).toBeInstanceOf(target.defaultView!.AbortSignal);
		expect(connections[1]!.signal.aborted).toBe(false);
		document.dispatchEvent(new Event("aui-adopted"));
		target.dispatchEvent(new target.defaultView!.Event("aui-adopted"));
		expect(received).toEqual([target]);
		expect(element.shadowRoot!.querySelector("span")).toBe(node);
		expect(target.defaultView!.getComputedStyle(node).color).toBe("rgb(12, 34, 56)");
	},
);
