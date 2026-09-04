import { Signal } from "@serve-tools/signal";
import { createBindingScope } from "@serve-tools/signal-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
	createFragment,
	html as currentHtml,
	scopedHtml as currentScopedHtml,
	html as describeHtml,
	PersistentFragment,
} from "../../../../client-signals/dom/dist/template.js";
import { AUIElement } from "../../src/aui-element.js";

type View = DocumentFragment & { dispose(): void };
type Tag = (strings: TemplateStringsArray, ...values: unknown[]) => View;

interface Renderer {
	name: string;
	persistent(owner: object): Tag;
	scoped(owner: object): Tag;
}

const renderers: readonly Renderer[] = [
	{
		name: "descriptor API",
		persistent:
			(owner) =>
			(strings, ...values) =>
				createFragment(describeHtml(strings, ...values), owner),
		scoped:
			(owner) =>
			(strings, ...values) =>
				createFragment(describeHtml(strings, ...values), owner),
	},
	{
		name: "legacy adapters",
		persistent: (owner) => currentHtml(owner),
		scoped: (owner) => currentScopedHtml(owner),
	},
];

const fixtures: Element[] = [];
const views: View[] = [];
const microtask = () => new Promise<void>(queueMicrotask);

afterEach(() => {
	for (const view of views.splice(0).reverse()) {
		view.dispose();
	}
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const retain = <T extends View>(view: T): T => {
	views.push(view);

	return view;
};

const fixture = <T extends Element>(element: T): T => {
	fixtures.push(element);
	document.body.append(element);

	return element;
};

const create = <T extends AUIElement>(constructor: new () => T): T => {
	const name = `aui-template-conformance-${crypto.randomUUID()}`;
	customElements.define(name, constructor);
	const element = document.createElement(name) as T;
	fixtures.push(element);

	return element;
};

describe("production template conformance", () => {
	test("keeps template descriptions inert until an owner instantiates them", async () => {
		const value = new Signal.State("before");
		const directive = vi.fn();
		const result = describeHtml`<button ${directive}>${value}</button>`;

		expect(result).not.toBeInstanceOf(Node);
		expect(directive).not.toHaveBeenCalled();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);

		const view = retain(createFragment(result, {}));
		const button = view.querySelector("button")!;
		expect(button.textContent).toBe("before");
		expect(directive).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);

		value.set("after");
		await microtask();
		expect(button.textContent).toBe("after");
	});

	test("prepares one cached template per document for repeated descriptions from one literal site", () => {
		const foreign = document.implementation.createHTMLDocument("template cache");
		const localCreateElement = vi.spyOn(document, "createElement");
		const foreignCreateElement = vi.spyOn(foreign, "createElement");
		const describe = (value: string) => describeHtml`<p>${value}</p>`;

		const localFirst = retain(createFragment(describe("local first"), {}));
		const localSecond = retain(createFragment(describe("local second"), {}));
		const foreignFirst = retain(createFragment(describe("foreign first"), foreign.body));
		const foreignSecond = retain(createFragment(describe("foreign second"), foreign.body));

		expect(localFirst.textContent).toBe("local first");
		expect(localSecond.textContent).toBe("local second");
		expect(foreignFirst.textContent).toBe("foreign first");
		expect(foreignSecond.textContent).toBe("foreign second");
		expect(localCreateElement.mock.calls.filter(([name]) => name === "template")).toHaveLength(1);
		expect(foreignCreateElement.mock.calls.filter(([name]) => name === "template")).toHaveLength(1);
	});

	test.each(renderers)("$name isolates repeated instances of one static template", async (renderer) => {
		const firstOwner = { name: "first" };
		const secondOwner = { name: "second" };
		const firstValue = new Signal.State("A");
		const secondValue = new Signal.State("B");
		const receivers: unknown[] = [];
		const handler = function (this: unknown) {
			receivers.push(this);
		};
		const instantiate = (owner: object, value: Signal.State<string>) =>
			retain(
				renderer.persistent(
					owner,
				)`<label><input .value=${value}><button @click=${handler}>${value}</button></label>`,
			);

		const first = instantiate(firstOwner, firstValue);
		const second = instantiate(secondOwner, secondValue);
		const firstInput = first.querySelector("input")!;
		const secondInput = second.querySelector("input")!;
		const firstButton = first.querySelector("button")!;
		const secondButton = second.querySelector("button")!;

		firstInput.value = "draft";
		secondValue.set("B2");
		await microtask();
		expect(firstInput.value).toBe("draft");
		expect(secondInput.value).toBe("B2");
		expect(firstButton.textContent).toBe("A");
		expect(secondButton.textContent).toBe("B2");

		firstButton.click();
		secondButton.click();
		expect(receivers).toEqual([firstOwner, secondOwner]);

		first.dispose();
		expect(Signal.subtle.introspectSinks(firstValue)).toHaveLength(0);
		expect(Signal.subtle.introspectSinks(secondValue)).toHaveLength(2);
	});

	test.each(renderers)("$name updates text and properties, then stops at disposal", async (renderer) => {
		const label = new Signal.State("<strong>safe</strong>");
		const disabled = new Signal.State(false);
		const view = retain(renderer.persistent({})`<button .disabled=${disabled}>${label}</button>`);
		const button = view.querySelector("button")!;

		expect(button.textContent).toBe("<strong>safe</strong>");
		expect(button.querySelector("strong")).toBeNull();
		expect(button.disabled).toBe(false);

		label.set("updated");
		disabled.set(true);
		await microtask();
		expect(button.textContent).toBe("updated");
		expect(button.disabled).toBe(true);

		view.dispose();
		label.set("ignored");
		disabled.set(false);
		await microtask();
		expect(button.textContent).toBe("updated");
		expect(button.disabled).toBe(true);
	});

	test.each(renderers)("$name preserves function and object event receivers", async (renderer) => {
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
		const view = retain(renderer.persistent(owner)`<button @click=${handler}>click</button>`);
		const button = view.querySelector("button")!;

		button.click();
		handler.set(second);
		await microtask();
		button.click();
		handler.set(null);
		await microtask();
		button.click();
		expect(receivers).toEqual([owner, second]);

		view.dispose();
		handler.set(first);
		await microtask();
		button.click();
		expect(receivers).toEqual([owner, second]);
	});

	test.each(renderers)("$name rolls back partial setup and preserves cleanup errors", async (renderer) => {
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
			renderer.persistent({})`<button @click=${click}>${value}</button><div ${(element: Element) => {
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
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);

		value.set("after");
		await microtask();
		button!.click();
		expect(button!.textContent).toBe("before");
		expect(click).not.toHaveBeenCalled();
	});

	test.each(renderers)("$name follows AUI layout suspension without rebuilding nodes", async (renderer) => {
		const value = new Signal.State("before");
		const clicks = vi.fn();
		const directive = vi.fn(() => vi.fn());
		let view: View;
		const element = create(
			class extends AUIElement {
				protected layout(content: DocumentFragment): void {
					view = retain(renderer.scoped(this)`<button @click=${clicks} ${directive}>${value}</button>`);
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
		value.set("detached");
		await microtask();
		expect(button.textContent).toBe("before");
		button.click();
		expect(clicks).toHaveBeenCalledOnce();

		document.body.append(element);
		expect(element.querySelector("button")).toBe(button);
		expect(button.firstChild).toBe(textNode);
		expect(button.textContent).toBe("detached");
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);
		button.click();
		expect(clicks).toHaveBeenCalledTimes(2);
	});

	test.each(renderers)("$name keeps persistent regions reusable while detached or hidden", async (renderer) => {
		const rows = ["A", "B"].map((name) => {
			const count = new Signal.State(0);
			const view = retain(renderer.persistent({})`<label><input .value=${name}><span>${count}</span></label>`);
			const label = view.querySelector("label")!;

			return {
				count,
				input: label.querySelector("input")!,
				label,
				region: new PersistentFragment([view]),
			};
		});
		const [first, second] = rows;
		const order = new Signal.State(rows.map((row) => row.region));
		const parent = retain(renderer.persistent({})`<section>${order}</section>`);
		const section = parent.querySelector("section")!;
		fixture(document.createElement("div")).append(parent);

		first.input.value = "draft";
		order.set([second.region, first.region]);
		await microtask();
		expect([...section.querySelectorAll("label")]).toEqual([second.label, first.label]);

		first.region.hidden = true;
		first.count.set(1);
		await microtask();
		expect(section.contains(first.label)).toBe(false);
		expect(first.label.querySelector("span")!.textContent).toBe("1");
		first.region.hidden = false;
		expect(first.input.value).toBe("draft");

		order.set([]);
		await microtask();
		first.count.set(2);
		await microtask();
		expect(first.label.querySelector("span")!.textContent).toBe("2");
		order.set([first.region, second.region]);
		await microtask();
		expect([...section.querySelectorAll("label")]).toEqual([first.label, second.label]);
		expect(first.region.nodes).toContain(first.label);
		expect(first.input.value).toBe("draft");
	});

	test.each(renderers)("$name rejects unsupported grammar before starting bindings", (renderer) => {
		const directive = vi.fn();
		const read = vi.fn(() => "value");
		const value = new Signal.Computed(read);

		expect(() => renderer.persistent({})`<div ${directive}></div><textarea>${value}</textarea>`).toThrow(
			SyntaxError,
		);
		expect(directive).not.toHaveBeenCalled();
		expect(read).not.toHaveBeenCalled();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);
	});

	test("supports nested descriptions, including inside iterable children", () => {
		const nested = describeHtml`<span>child</span>`;

		expect(retain(createFragment(describeHtml`<div>${nested}</div>`, {})).querySelector("span")?.textContent).toBe(
			"child",
		);
		expect(
			retain(createFragment(describeHtml`<div>${[nested]}</div>`, {})).querySelector("span")?.textContent,
		).toBe("child");
	});

	test("matches current inert custom-element cloning and upgrade timing", () => {
		const name = `aui-template-upgrade-${crypto.randomUUID()}`;
		let constructions = 0;
		let connections = 0;
		class Probe extends HTMLElement {
			constructor() {
				super();
				++constructions;
			}

			connectedCallback(): void {
				++connections;
			}
		}
		customElements.define(name, Probe);
		const strings = [`<${name}></${name}>`] as unknown as TemplateStringsArray;
		Object.defineProperty(strings, "raw", { value: [...strings] });

		for (const renderer of renderers) {
			const before = constructions;
			const first = retain(renderer.persistent({})(strings));
			const second = retain(renderer.persistent({})(strings));
			const firstElement = first.firstElementChild!;
			const secondElement = second.firstElementChild!;

			expect(constructions, renderer.name).toBe(before);
			expect(firstElement, renderer.name).not.toBeInstanceOf(Probe);
			expect(secondElement, renderer.name).not.toBeInstanceOf(Probe);

			fixture(document.createElement("div")).append(first, second);
			expect(firstElement, renderer.name).toBeInstanceOf(Probe);
			expect(secondElement, renderer.name).toBeInstanceOf(Probe);
			expect(constructions, renderer.name).toBe(before + 2);
			expect(connections, renderer.name).toBe(before + 2);
		}
	});

	test.each(renderers)(
		"$name caches preparation per document and keeps scope ownership separate",
		async (renderer) => {
			const frame = fixture(document.createElement("iframe"));
			const foreign = frame.contentDocument!;
			const localValue = new Signal.State("local");
			const foreignValue = new Signal.State("foreign");
			const localScope = createBindingScope();
			const foreignScope = createBindingScope();
			const instantiate = (
				scope: ReturnType<typeof createBindingScope>,
				owner: object,
				value: Signal.State<string>,
			) => {
				let view!: View;
				scope.capture(() => {
					view = retain(renderer.scoped(owner)`<p>${value}</p>`);
				});

				return view;
			};

			const localView = instantiate(localScope, document.body, localValue);
			const foreignView = instantiate(foreignScope, foreign.body, foreignValue);
			const localParagraph = localView.querySelector("p")!;
			const foreignParagraph = foreignView.querySelector("p")!;
			expect(localParagraph.ownerDocument).not.toBe(document);
			expect(foreignParagraph.ownerDocument).not.toBe(foreign);
			document.body.append(localView);
			foreign.body.append(foreignView);
			expect(localParagraph.ownerDocument).toBe(document);
			expect(foreignParagraph.ownerDocument).toBe(foreign);
			expect(Signal.subtle.introspectSinks(localValue)).toHaveLength(0);
			expect(Signal.subtle.introspectSinks(foreignValue)).toHaveLength(0);

			expect(localScope.resume()).toBe(true);
			expect(Signal.subtle.introspectSinks(localValue)).toHaveLength(1);
			expect(Signal.subtle.introspectSinks(foreignValue)).toHaveLength(0);
			expect(foreignScope.resume()).toBe(true);
			expect(Signal.subtle.introspectSinks(foreignValue)).toHaveLength(1);

			localScope.suspend();
			localValue.set("local detached");
			foreignValue.set("foreign active");
			await microtask();
			expect(localParagraph.textContent).toBe("local");
			expect(foreignParagraph.textContent).toBe("foreign active");
			expect(Signal.subtle.introspectSinks(localValue)).toHaveLength(0);
			expect(Signal.subtle.introspectSinks(foreignValue)).toHaveLength(1);

			expect(localScope.resume()).toBe(true);
			expect(localParagraph.textContent).toBe("local detached");
			localScope.dispose();
			foreignScope.dispose();
		},
	);
});
