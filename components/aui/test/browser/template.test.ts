import { Signal } from "@serve-tools/signal";
import { createBindingScope } from "@serve-tools/signal-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AUIElement } from "../../src/aui-element.js";
import type { TemplateDirective, TemplateFragment } from "../../src/template.js";
import { html, PersistentFragment, scopedHtml } from "../../src/template.js";

const fixtures: Element[] = [];
const templates: TemplateFragment[] = [];
const microtask = () => new Promise<void>(queueMicrotask);

afterEach(() => {
	for (const template of templates.splice(0)) {
		template.dispose();
	}
	for (const fixture of fixtures.splice(0)) {
		fixture.remove();
	}
});

const fixture = <T extends Element>(element: T): T => {
	fixtures.push(element);
	document.body.append(element);
	return element;
};

const retain = (template: TemplateFragment): TemplateFragment => {
	templates.push(template);
	return template;
};

const create = <T extends AUIElement>(constructor: new () => T): T => {
	const name = `aui-template-${crypto.randomUUID()}`;
	customElements.define(name, constructor);
	const element = document.createElement(name) as T;
	fixtures.push(element);
	return element;
};

describe("owner-local templates", () => {
	test("updates text, whole attributes, and properties without interpreting child strings as HTML", async () => {
		const label = new Signal.State("<strong>safe</strong>");
		const title = new Signal.State<string | null>("initial");
		const disabled = new Signal.State(false);
		const count = new Signal.State(2);
		const doubled = new Signal.Computed(() => count.get() * 2);
		const view = retain(html({})`<button title=${title} .disabled=${disabled}>${label}: ${doubled}</button>`);
		const button = view.querySelector("button")!;
		fixture(document.createElement("div")).append(view);
		expect(button.textContent).toBe("<strong>safe</strong>: 4");
		expect(button.querySelector("strong")).toBeNull();
		expect(button.title).toBe("initial");
		expect(button.disabled).toBe(false);

		label.set("updated");
		title.set(null);
		disabled.set(true);
		count.set(3);
		await Promise.resolve();
		expect(button.textContent).toBe("updated: 6");
		expect(button.hasAttribute("title")).toBe(false);
		expect(button.disabled).toBe(true);

		view.dispose();
		label.set("ignored");
		disabled.set(false);
		await Promise.resolve();
		expect(button.textContent).toBe("updated: 6");
		expect(button.disabled).toBe(true);
	});

	test("preserves owner-bound functions and object handlers through replacement, null, and disposal", async () => {
		const owner = {};
		const receivers: unknown[] = [];
		const first = function (this: unknown) {
			receivers.push(this);
		};
		const second = {
			handleEvent() {
				receivers.push(this);
			},
		};
		const handler = new Signal.State<EventListener | EventListenerObject | null>(first);
		const view = retain(html(owner)`<button @click=${handler}>click</button>`);
		const button = view.querySelector("button")!;
		button.click();
		handler.set(second);
		await Promise.resolve();
		button.click();
		expect(receivers).toEqual([owner, second]);

		handler.set(null);
		await Promise.resolve();
		button.click();
		handler.set(first);
		await Promise.resolve();
		button.click();
		view.dispose();
		button.click();
		expect(receivers).toEqual([owner, second, owner]);
	});

	test("replaces listeners when capture, once, passive, or abort options change", async () => {
		let calls = 0;
		const create = (options: AddEventListenerOptions = {}) =>
			Object.assign(() => {
				++calls;
			}, options);
		const handler = new Signal.State(create());
		const view = retain(html({})`<button @click=${handler}>click</button>`);
		const button = view.querySelector("button")!;
		button.click();
		for (const options of [{ capture: true }, { capture: false, passive: true }, { once: true }]) {
			handler.set(create(options));
			await Promise.resolve();
			button.click();
		}
		expect(calls).toBe(4);
		button.click();
		expect(calls).toBe(4);

		const controller = new AbortController();
		handler.set(create({ signal: controller.signal }));
		await Promise.resolve();
		button.click();
		controller.abort();
		button.click();
		expect(calls).toBe(5);
		handler.set(create());
		await Promise.resolve();
		button.click();
		expect(calls).toBe(6);
	});

	test("drains every directive cleanup once even if cleanup reenters or throws", () => {
		const calls: string[] = [];
		const failure = new Error("cleanup failed");
		let view: TemplateFragment;
		view = html({})`<div ${() => () => {
			calls.push("first");
			view.dispose();
			throw failure;
		}}
			${() => () => {
				calls.push("second");
			}}></div>`;
		expect(() => view.dispose()).toThrow(failure);
		expect(calls).toEqual(["first", "second"]);
		view.dispose();
		expect(calls).toEqual(["first", "second"]);
	});

	test("rolls back effects, listeners, and directives when later setup fails", async () => {
		const setupFailure = new Error("setup failed");
		const cleanupFailure = new Error("cleanup failed");
		const value = new Signal.State("before");
		const click = vi.fn();
		const cleanup = vi.fn(() => {
			throw cleanupFailure;
		});
		let button: HTMLButtonElement | undefined;
		let thrown: unknown;
		try {
			html({})`<button @click=${click}>${value}</button><div ${(element: Element) => {
				button = element.previousElementSibling as HTMLButtonElement;
				return cleanup;
			}} ${() => {
				throw setupFailure;
			}}></div>`;
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(AggregateError);
		expect((thrown as AggregateError).errors).toEqual([setupFailure, cleanupFailure]);
		expect(cleanup).toHaveBeenCalledOnce();
		value.set("after");
		await Promise.resolve();
		button!.click();
		expect(click).not.toHaveBeenCalled();
		expect(button!.textContent).toBe("before");
	});

	test("stops setup when a directive disposes its root and immediately retires its returned cleanup", () => {
		const cleanup = vi.fn();
		const later = vi.fn();
		const read = vi.fn(() => "never");
		const value = new Signal.Computed(read);
		const view = retain(
			html({})`<div ${(element: Element) => {
				(element.getRootNode() as TemplateFragment).dispose();
				return cleanup;
			}} ${later}>${value}</div>`,
		);
		expect(cleanup).toHaveBeenCalledOnce();
		expect(later).not.toHaveBeenCalled();
		expect(read).not.toHaveBeenCalled();
		view.dispose();
		expect(cleanup).toHaveBeenCalledOnce();
	});

	test("preserves a directive failure after the directive disposes its root", () => {
		const failure = new Error("directive failed after disposal");
		expect(
			() =>
				html({})`<div ${(element: Element) => {
					(element.getRootNode() as TemplateFragment).dispose();
					throw failure;
				}}></div>`,
		).toThrow(failure);
	});

	test("retires an effect whose initial property write disposes the template", async () => {
		const source = new Signal.State("first");
		const values: unknown[] = [];
		const later = vi.fn();
		retain(
			html({})`<div ${(element: Element) => {
				Object.defineProperty(element, "value", {
					set(value) {
						values.push(value);
						(element.getRootNode() as TemplateFragment).dispose();
					},
				});
			}} .value=${source} ${later}></div>`,
		);
		source.set("second");
		await Promise.resolve();
		expect(values).toEqual(["first"]);
		expect(later).not.toHaveBeenCalled();
	});

	test("disposes pending effects independently for templates sharing one owner", async () => {
		const owner = {};
		const value = new Signal.State("before");
		const first = retain(html(owner)`<p>${value}</p>`);
		const second = retain(html(owner)`<p>${value}</p>`);
		value.set("after");
		first.dispose();
		await Promise.resolve();
		expect(first.textContent).toBe("before");
		expect(second.textContent).toBe("after");
		value.set("again");
		await Promise.resolve();
		expect(second.textContent).toBe("again");
	});

	test("parks, hides, restores, and reorders persistent rows without disposing their own views", async () => {
		const rows = ["A", "B"].map((name) => {
			const owner = {};
			const count = new Signal.State(0);
			const view = retain(
				html(
					owner,
				)`<label><input .value=${name}><button @click=${() => count.set(count.get() + 1)}>${count}</button></label>`,
			);
			const label = view.querySelector("label")!;
			return { view, count, label, input: label.querySelector("input")!, region: new PersistentFragment([view]) };
		});
		const [first, second] = rows;
		const order = new Signal.State(rows.map((row) => row.region));
		const parent = retain(html({})`<section>${order}</section>`);
		const section = parent.querySelector("section")!;
		fixture(document.createElement("div")).append(parent);
		first.input.value = "unsent draft";
		order.set([second.region, first.region]);
		await Promise.resolve();
		expect([...section.querySelectorAll("label")]).toEqual([second.label, first.label]);
		first.region.hidden = true;
		first.count.set(1);
		await Promise.resolve();
		expect(section.contains(first.label)).toBe(false);
		expect(first.label.querySelector("button")!.textContent).toBe("1");
		first.region.hidden = false;
		expect(first.input.value).toBe("unsent draft");

		order.set([]);
		await Promise.resolve();
		expect(section.querySelector("label")).toBeNull();
		first.label.querySelector("button")!.click();
		await Promise.resolve();
		expect(first.label.querySelector("button")!.textContent).toBe("2");
		order.set([first.region, second.region]);
		await Promise.resolve();
		expect([...section.querySelectorAll("label")]).toEqual([first.label, second.label]);
		expect(first.input.value).toBe("unsent draft");

		parent.dispose();
		first.count.set(3);
		await Promise.resolve();
		expect(first.label.querySelector("button")!.textContent).toBe("3");
		first.view.dispose();
		first.count.set(4);
		await Promise.resolve();
		expect(first.label.querySelector("button")!.textContent).toBe("3");
	});

	test("snapshots nested iterables and live node collections before moving their nodes", async () => {
		const source = document.createElement("div");
		source.innerHTML = "<i>A</i><i>B</i><i>C</i>";
		const children = [...source.children];
		const values = new Signal.State<unknown>([source.childNodes, ["tail", null]]);
		const view = retain(html({})`<section>${values}</section>`);
		const section = view.querySelector("section")!;
		expect([...section.children]).toEqual(children);
		expect(section.textContent).toBe("ABCtail");
		expect(source.childNodes).toHaveLength(0);
		values.set(section.children);
		await Promise.resolve();
		expect([...section.children]).toEqual(children);
		expect(section.textContent).toBe("ABC");
	});

	test.each([
		[
			"mixed attribute",
			(directive: TemplateDirective) => html({})`<div ${directive} title="prefix ${"value"}"></div>`,
		],
		[
			"unquoted attribute suffix",
			(directive: TemplateDirective) => html({})`<div ${directive} title=${"value"}suffix></div>`,
		],
		["dynamic tag", (directive: TemplateDirective) => html({})`<div ${directive}></div><${"div"}>`],
		["directive suffix", (directive: TemplateDirective) => html({})`<div ${directive}suffix></div>`],
		["directive assignment", (directive: TemplateDirective) => html({})`<div ${directive}="x"></div>`],
		[
			"raw text",
			(directive: TemplateDirective) => html({})`<div ${directive}></div><textarea>${"value"}</textarea>`,
		],
		[
			"script text",
			(directive: TemplateDirective) => html({})`<div ${directive}></div><script>${"value"}</script>`,
		],
		[
			"nested template",
			(directive: TemplateDirective) => html({})`<div ${directive}></div><template>${"value"}</template>`,
		],
	] as const)("rejects unsupported %s holes before running directives", (_, render) => {
		const directive = vi.fn();
		expect(() => render(directive)).toThrow(SyntaxError);
		expect(directive).not.toHaveBeenCalled();
	});

	test("accepts ordinary less-than text before a child binding", async () => {
		const value = new Signal.State("ready");
		const view = retain(html({})`a < b ${value}`);
		expect(view.textContent).toBe("a < b ready");
		value.set("updated");
		await Promise.resolve();
		expect(view.textContent).toBe("a < b updated");
	});

	test("creates templates for a foreign document and accepts nodes from both realms", async () => {
		const frame = fixture(document.createElement("iframe"));
		const foreign = frame.contentDocument!;
		const foreignNode = foreign.createElement("strong");
		foreignNode.textContent = "foreign";
		const localNode = document.createElement("em");
		localNode.textContent = "local";
		const value = new Signal.State<unknown>(foreignNode);
		const view = retain(html(foreign.body)`<section>${value}</section>`);
		const section = view.querySelector("section")!;
		foreign.body.append(view);
		expect(section.ownerDocument).toBe(foreign);
		expect(section.firstElementChild).toBe(foreignNode);
		value.set(localNode);
		await Promise.resolve();
		expect(section.firstElementChild).toBe(localNode);
		expect(localNode.ownerDocument).toBe(foreign);
	});

	test("preserves node identity when a child has already been adopted into another realm", () => {
		const frame = fixture(document.createElement("iframe"));
		const foreign = frame.contentDocument!;
		const localNode = document.createElement("strong");
		localNode.textContent = "local prototype";
		foreign.adoptNode(localNode);
		const foreignView = retain(html(foreign.body)`<section>${localNode}</section>`);
		const foreignSection = foreignView.querySelector("section")!;
		foreign.body.append(foreignView);
		expect(foreignSection.firstElementChild).toBe(localNode);
		expect(foreignSection.textContent).toBe("local prototype");

		const foreignNode = foreign.createElement("em");
		foreignNode.textContent = "foreign prototype";
		document.adoptNode(foreignNode);
		const localView = retain(html({})`<section>${foreignNode}</section>`);
		const localSection = localView.querySelector("section")!;
		fixture(document.createElement("div")).append(localView);
		expect(localSection.firstElementChild).toBe(foreignNode);
		expect(localSection.textContent).toBe("foreign prototype");
	});
});

describe("connection-scoped templates", () => {
	test("suspends updates while retaining nodes, listeners, and directives across connections", async () => {
		const value = new Signal.State("before");
		const clicks = vi.fn();
		const cleanup = vi.fn();
		const directive = vi.fn(() => cleanup);
		let view: TemplateFragment;
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					view = scopedHtml(this)`<button @click=${clicks} ${directive}>${value}</button>`;
					content.append(view);
				}
			},
		);

		document.body.append(element);
		const button = element.querySelector("button")!;
		const textNode = button.firstChild!;
		expect(button.textContent).toBe("before");
		expect(directive).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);

		element.remove();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		expect(cleanup).not.toHaveBeenCalled();
		textNode.textContent = "changed outside the binding";
		document.body.append(element);
		expect(element.querySelector("button")).toBe(button);
		expect(button.firstChild).toBe(textNode);
		expect(button.textContent).toBe("before");
		expect(directive).toHaveBeenCalledOnce();

		value.set("queued");
		element.remove();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		value.set("detached");
		await microtask();
		expect(button.textContent).toBe("before");
		button.click();
		expect(clicks).toHaveBeenCalledOnce();

		document.body.append(element);
		expect(element.querySelector("button")).toBe(button);
		expect(button.textContent).toBe("detached");
		button.click();
		expect(clicks).toHaveBeenCalledTimes(2);
		expect(directive).toHaveBeenCalledOnce();
		expect(cleanup).not.toHaveBeenCalled();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);
	});

	test("does not rearm a consumed once listener when its binding resumes", () => {
		const calls = vi.fn();
		const handler = new Signal.State(Object.assign(calls, { once: true }));
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					content.append(scopedHtml(this)`<button @click=${handler}>click</button>`);
				}
			},
		);

		document.body.append(element);
		const button = element.querySelector("button")!;
		button.click();
		button.click();
		expect(calls).toHaveBeenCalledOnce();

		element.remove();
		expect(Signal.subtle.introspectSinks(handler)).toHaveLength(0);
		document.body.append(element);
		button.click();
		expect(calls).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(handler)).toHaveLength(1);
	});

	test("treats explicit view disposal as terminal across later host connections", async () => {
		const value = new Signal.State("before");
		const clicks = vi.fn();
		const cleanup = vi.fn();
		let view: TemplateFragment;
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					view = scopedHtml(this)`<button @click=${clicks} ${() => cleanup}>${value}</button>`;
					content.append(view);
				}
			},
		);

		document.body.append(element);
		const button = element.querySelector("button")!;
		view!.dispose();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		button.click();
		expect(clicks).not.toHaveBeenCalled();

		value.set("ignored");
		element.remove();
		document.body.append(element);
		await microtask();
		expect(element.querySelector("button")).toBe(button);
		expect(button.textContent).toBe("before");
		expect(cleanup).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		button.click();
		expect(clicks).not.toHaveBeenCalled();
	});

	test("rolls back listeners and directives from every view when later layout work fails", async () => {
		const failure = new Error("later layout failed");
		const value = new Signal.State("before");
		const clicks = [vi.fn(), vi.fn()];
		const cleanups = [vi.fn(), vi.fn()];
		const buttons: HTMLButtonElement[] = [];
		const element = create(
			class extends AUIElement {
				override connectedCallback(): void {}

				protected layout(content: DocumentFragment): void {
					for (let index = 0; index < 2; ++index) {
						const view = scopedHtml(
							this,
						)`<button @click=${clicks[index]} ${() => cleanups[index]}>${value}</button>`;
						buttons.push(view.querySelector("button")!);
						content.append(view);
					}
					throw failure;
				}
			},
		);
		document.body.append(element);

		expect(() => AUIElement.prototype.connectedCallback.call(element)).toThrow(failure);
		expect(cleanups[0]).toHaveBeenCalledOnce();
		expect(cleanups[1]).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		buttons[0].click();
		buttons[1].click();
		expect(clicks[0]).not.toHaveBeenCalled();
		expect(clicks[1]).not.toHaveBeenCalled();

		value.set("ignored");
		await microtask();
		expect(buttons.map((button) => button.textContent)).toEqual(["before", "before"]);
		AUIElement.prototype.connectedCallback.call(element);
		expect(buttons).toHaveLength(2);
	});

	test("retires setup immediately when a directive disposes the active scope", () => {
		const scope = createBindingScope();
		const clicks = vi.fn();
		const cleanup = vi.fn();
		const later = vi.fn();
		let view: TemplateFragment;

		scope.capture(() => {
			view = scopedHtml({})`<button @click=${clicks} ${() => {
				scope.dispose();
				return cleanup;
			}} ${later}>click</button>`;
		});

		view!.querySelector("button")!.click();
		expect(clicks).not.toHaveBeenCalled();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(later).not.toHaveBeenCalled();
		expect(scope.resume()).toBe(false);
		view!.dispose();
		expect(cleanup).toHaveBeenCalledOnce();
	});

	test("preserves a directive error after it disposes its scope", () => {
		const scope = createBindingScope();
		const failure = new Error("failed after scope disposal");
		const cleanup = vi.fn();
		expect(() =>
			scope.capture(
				() =>
					scopedHtml({})`<div ${() => cleanup} ${() => {
						scope.dispose();
						throw failure;
					}}></div>`,
			),
		).toThrow(failure);
		expect(cleanup).toHaveBeenCalledOnce();
		expect(scope.resume()).toBe(false);
	});

	test("tracks incidental writer reads persistently, and after a scoped view activates", async () => {
		const persistentSource = new Signal.State("persistent");
		const persistentIncidental = new Signal.State(0);
		const persistentWrites: string[] = [];
		const persistentView = retain(
			html({})`<span ${
				((element: Element) => {
					Object.defineProperty(element, "value", {
						set: (value: string) => persistentWrites.push(`${value}:${persistentIncidental.get()}`),
					});
				}) as TemplateDirective
			} .value=${persistentSource}></span>`,
		);
		expect(persistentWrites).toEqual(["persistent:0"]);
		expect(Signal.subtle.introspectSinks(persistentSource)).toHaveLength(1);
		expect(Signal.subtle.introspectSinks(persistentIncidental)).toHaveLength(1);

		const scopedSource = new Signal.State("scoped");
		const scopedIncidental = new Signal.State(0);
		const scopedWrites: string[] = [];
		const scope = createBindingScope();
		let scopedView: TemplateFragment;
		scope.capture(() => {
			scopedView = scopedHtml({})`<span ${
				((element: Element) => {
					Object.defineProperty(element, "value", {
						set: (value: string) => scopedWrites.push(`${value}:${scopedIncidental.get()}`),
					});
				}) as TemplateDirective
			} .value=${scopedSource}></span>`;
		});
		expect(scopedWrites).toEqual(["scoped:0"]);
		expect(Signal.subtle.introspectSinks(scopedSource)).toHaveLength(0);
		expect(Signal.subtle.introspectSinks(scopedIncidental)).toHaveLength(0);

		expect(scope.resume()).toBe(true);
		expect(scopedWrites).toEqual(["scoped:0", "scoped:0"]);
		expect(Signal.subtle.introspectSinks(scopedSource)).toHaveLength(1);
		expect(Signal.subtle.introspectSinks(scopedIncidental)).toHaveLength(1);
		scopedIncidental.set(1);
		await microtask();
		expect(scopedWrites).toEqual(["scoped:0", "scoped:0", "scoped:1"]);

		scopedView!.dispose();
		expect(Signal.subtle.introspectSinks(scopedSource)).toHaveLength(0);
		expect(Signal.subtle.introspectSinks(scopedIncidental)).toHaveLength(0);
		persistentView.dispose();
	});

	test("leaves standalone templates persistent when they are created inside layout", async () => {
		const value = new Signal.State("before");
		let view: TemplateFragment;
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					view = retain(html(this)`<span>${value}</span>`);
					content.append(view);
				}
			},
		);

		document.body.append(element);
		const span = element.querySelector("span")!;
		element.remove();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);
		value.set("detached");
		await microtask();
		expect(span.textContent).toBe("detached");

		view!.dispose();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		value.set("ignored");
		await microtask();
		expect(span.textContent).toBe("detached");
	});

	test("updates hidden persistent content in a closed shadow root only while its host is connected", async () => {
		const value = new Signal.State("before");
		let root: ShadowRoot;
		let region: PersistentFragment;
		let span: HTMLSpanElement;
		const element = create(
			class extends AUIElement {
				protected createLayoutRoot(): ShadowRoot {
					return (root = this.attachShadow({ mode: "closed" }));
				}

				protected layout(content: DocumentFragment): void {
					const view = scopedHtml(this)`<span>${value}</span>`;
					span = view.querySelector("span")!;
					region = new PersistentFragment([view], this.ownerDocument);
					region.hidden = true;
					region.insertBefore(content);
				}
			},
		);

		document.body.append(element);
		expect(element.shadowRoot).toBeNull();
		expect(root!.textContent).toBe("");
		value.set("hidden");
		await microtask();
		expect(span!.textContent).toBe("hidden");

		element.remove();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
		value.set("detached");
		await microtask();
		expect(span!.textContent).toBe("hidden");
		document.body.append(element);
		expect(span!.textContent).toBe("detached");
		region!.hidden = false;
		expect(root!.firstElementChild).toBe(span!);
		expect(root!.textContent).toBe("detached");
	});

	test("preserves its nodes and active binding when the host is adopted", async () => {
		const value = new Signal.State("before");
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					content.append(scopedHtml(this)`<span>${value}</span>`);
				}
			},
		);

		document.body.append(element);
		const span = element.querySelector("span")!;
		const target = document.implementation.createHTMLDocument("adoption");
		target.body.append(target.adoptNode(element));
		expect(element.ownerDocument).toBe(target);
		expect(element.querySelector("span")).toBe(span);
		expect(span.ownerDocument).toBe(target);
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);

		value.set("adopted");
		await microtask();
		expect(span.textContent).toBe("adopted");
	});

	test("bounds reentrant removal and resumption from a reactive property setter", async () => {
		const value = new Signal.State("first");
		let reinsert = true;
		let depth = 0;
		let maximumDepth = 0;
		let writes = 0;
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					content.append(
						scopedHtml(this)`<span ${(node: Element) => {
							const span = node as HTMLSpanElement;
							Object.defineProperty(span, "value", {
								set: (next: string) => {
									maximumDepth = Math.max(maximumDepth, ++depth);
									++writes;
									if (reinsert) {
										reinsert = false;
										element.remove();
										document.body.append(element);
									}
									span.setAttribute("data-value", next);
									--depth;
								},
							});
						}} .value=${value}></span>`,
					);
				}
			},
		);

		document.body.append(element);
		await microtask();
		await microtask();
		expect(maximumDepth).toBe(1);
		expect(writes).toBe(2);
		expect(element.querySelector("span")?.getAttribute("data-value")).toBe("first");
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);

		value.set("second");
		await microtask();
		expect(writes).toBe(3);
		expect(element.querySelector("span")?.getAttribute("data-value")).toBe("second");
	});

	test("rejects use outside synchronous binding capture before setup starts", () => {
		const directive = vi.fn();
		const value = new Signal.State("unused");
		expect(() => scopedHtml({})`<div ${directive}>${value}</div>`).toThrow(TypeError);
		expect(directive).not.toHaveBeenCalled();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
	});
});
