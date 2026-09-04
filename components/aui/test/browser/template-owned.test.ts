import { Signal } from "@serve-tools/signal";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AUIElement } from "../../src/aui-element.js";
import type { TemplateFragment, TemplateResult } from "../../src/template.js";
import { createFragment, html, PersistentFragment } from "../../src/template.js";

const fixtures: Element[] = [];
const views: TemplateFragment[] = [];
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

const retain = <T extends TemplateFragment>(view: T): T => {
	views.push(view);

	return view;
};

const fixture = <T extends Element>(element: T): T => {
	fixtures.push(element);
	document.body.append(element);

	return element;
};

const create = <T extends AUIElement>(constructor: new () => T): T => {
	const name = `aui-template-owned-${crypto.randomUUID()}`;
	customElements.define(name, constructor);
	const element = document.createElement(name) as T;
	fixtures.push(element);

	return element;
};

interface Child {
	cleanup: ReturnType<typeof vi.fn>;
	result: TemplateResult;
	setups: ReturnType<typeof vi.fn>;
	value: Signal.State<string>;
}

const child = (name: string): Child => {
	const value = new Signal.State(name);
	const setups = vi.fn();
	const cleanup = vi.fn();
	const result = html`<label ${(element: Element) => {
		setups();
		element.setAttribute("data-name", name);

		return cleanup;
	}}><input .value=${name}><span>${value}</span></label>`;

	return { cleanup, result, setups, value };
};

describe("owned nested templates", () => {
	test("retires replaced children exactly once and leaves the surviving DOM in place on disposal", async () => {
		const first = child("first");
		const second = child("second");
		const selected = new Signal.State(first.result);
		const view = retain(createFragment(html`<section>${selected}</section>`, {}));
		const section = view.querySelector("section")!;
		fixture(document.createElement("div")).append(view);
		const firstLabel = section.querySelector("label")!;

		expect(first.setups).toHaveBeenCalledOnce();
		expect(first.cleanup).not.toHaveBeenCalled();
		expect(Signal.subtle.introspectSinks(first.value)).toHaveLength(1);

		selected.set(second.result);
		await microtask();
		const secondLabel = section.querySelector("label")!;
		expect(secondLabel).not.toBe(firstLabel);
		expect(secondLabel.dataset.name).toBe("second");
		expect(first.cleanup).toHaveBeenCalledOnce();
		expect(second.cleanup).not.toHaveBeenCalled();
		expect(Signal.subtle.introspectSinks(first.value)).toHaveLength(0);
		expect(Signal.subtle.introspectSinks(second.value)).toHaveLength(1);

		selected.set(second.result);
		await microtask();
		expect(section.querySelector("label")).toBe(secondLabel);
		expect(second.setups).toHaveBeenCalledOnce();
		expect(second.cleanup).not.toHaveBeenCalled();

		view.dispose();
		expect(section.querySelector("label")).toBe(secondLabel);
		expect(second.cleanup).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(second.value)).toHaveLength(0);
		view.dispose();
		expect(first.cleanup).toHaveBeenCalledOnce();
		expect(second.cleanup).toHaveBeenCalledOnce();
	});

	test("preserves input identity and authored state when descriptors reorder", async () => {
		const first = child("A");
		const second = child("B");
		const third = child("C");
		const order = new Signal.State([first.result, second.result, third.result]);
		const view = retain(createFragment(html`<section>${order}</section>`, {}));
		const section = view.querySelector("section")!;
		fixture(document.createElement("div")).append(view);
		const inputs = [...section.querySelectorAll("input")];
		inputs[0]!.value = "unsaved draft";

		order.set([third.result, first.result, second.result]);
		await microtask();
		expect([...section.querySelectorAll("input")]).toEqual([inputs[2], inputs[0], inputs[1]]);
		expect(inputs[0]!.value).toBe("unsaved draft");
		expect([
			first.setups.mock.calls.length,
			second.setups.mock.calls.length,
			third.setups.mock.calls.length,
		]).toEqual([1, 1, 1]);
		expect([
			first.cleanup.mock.calls.length,
			second.cleanup.mock.calls.length,
			third.cleanup.mock.calls.length,
		]).toEqual([0, 0, 0]);
	});

	test("isolates repeated instances and binds nested function handlers to each owner", () => {
		const receivers: unknown[] = [];
		const value = new Signal.State("ready");
		const nested = html`<button @click=${function (this: unknown) {
			receivers.push(this);
		}}>${value}</button>`;
		const description = html`<article>${nested}</article>`;
		const firstOwner = { name: "first" };
		const secondOwner = { name: "second" };
		const first = retain(createFragment(description, firstOwner));
		const second = retain(createFragment(description, secondOwner));
		const firstButton = first.querySelector("button")!;
		const secondButton = second.querySelector("button")!;

		expect(firstButton).not.toBe(secondButton);
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(2);
		firstButton.click();
		secondButton.click();
		expect(receivers).toEqual([firstOwner, secondOwner]);

		first.dispose();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);
		firstButton.click();
		secondButton.click();
		expect(receivers).toEqual([firstOwner, secondOwner, secondOwner]);
	});

	test("rolls back nested subscriptions, listeners, and directive resources after setup failure", async () => {
		const failure = new Error("nested setup failed");
		const value = new Signal.State("before");
		const click = vi.fn();
		const cleanup = vi.fn();
		let button: HTMLButtonElement | undefined;
		const nested = html`<button @click=${click} ${(element: Element) => {
			button = element as HTMLButtonElement;

			return cleanup;
		}}>${value}</button><i ${() => {
			throw failure;
		}}></i>`;

		expect(() => createFragment(html`<main>${nested}</main>`, {})).toThrow(failure);
		expect(cleanup).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(0);

		value.set("after");
		await microtask();
		button!.click();
		expect(button!.textContent).toBe("before");
		expect(click).not.toHaveBeenCalled();
	});

	test("keeps nested resources owned when DOM insertion fails", async () => {
		const invalid = document.implementation.createDocumentType("html", "", "");
		const createdValue = new Signal.State("created");
		const createdClick = vi.fn();
		const createdCleanup = vi.fn();
		let createdButton: HTMLButtonElement | undefined;
		const created = html`<button @click=${createdClick} ${(element: Element) => {
			createdButton = element as HTMLButtonElement;

			return createdCleanup;
		}}>${createdValue}</button>`;

		expect(() => createFragment(html`<section>${[created, invalid]}</section>`, {})).toThrow(DOMException);
		expect(createdCleanup).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(createdValue)).toHaveLength(0);
		createdButton!.click();
		expect(createdClick).not.toHaveBeenCalled();

		const retainedValue = new Signal.State("retained");
		const retainedClick = vi.fn();
		const retainedCleanup = vi.fn();
		const retained = html`<button @click=${retainedClick} ${() => retainedCleanup}>${retainedValue}</button>`;
		const content = new Signal.State<unknown>(retained);
		const view = retain(createFragment(html`<section>${content}</section>`, {}));
		const retainedButton = view.querySelector("button")!;
		let reported: unknown;
		const onError = (event: ErrorEvent) => {
			if (!(event.error instanceof DOMException)) {
				return;
			}
			reported = event.error;
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		window.addEventListener("error", onError, true);
		try {
			content.set(invalid);
			await microtask();
		} finally {
			window.removeEventListener("error", onError, true);
		}

		expect(reported).toBeInstanceOf(DOMException);
		expect(retainedCleanup).not.toHaveBeenCalled();
		expect(Signal.subtle.introspectSinks(content)).toHaveLength(1);
		expect(Signal.subtle.introspectSinks(retainedValue)).toHaveLength(0);
		retainedButton.click();
		expect(retainedClick).toHaveBeenCalledOnce();

		content.set(retained);
		await microtask();
		expect(view.querySelector("button")).toBe(retainedButton);
		expect(retainedCleanup).not.toHaveBeenCalled();
		expect(Signal.subtle.introspectSinks(retainedValue)).toHaveLength(1);

		view.dispose();
		expect(retainedCleanup).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(retainedValue)).toHaveLength(0);
		retainedButton.click();
		expect(retainedClick).toHaveBeenCalledOnce();
	});

	test("does not commit or leak a replacement whose directive disposes its parent", async () => {
		const oldValue = new Signal.State("old");
		const oldCleanup = vi.fn();
		const oldChild = html`<button ${() => oldCleanup}>${oldValue}</button>`;
		const selected = new Signal.State<TemplateResult>(oldChild);
		const view = retain(createFragment(html`<section>${selected}</section>`, {}));
		const section = view.querySelector("section")!;
		fixture(document.createElement("div")).append(view);
		const oldButton = section.querySelector("button")!;

		const newValue = new Signal.State("new");
		const newClick = vi.fn();
		const newCleanup = vi.fn();
		let newButton: HTMLButtonElement | undefined;
		const replacement = html`<button @click=${newClick} ${(element: Element) => {
			newButton = element as HTMLButtonElement;
			view.dispose();

			return newCleanup;
		}}>${newValue}</button>`;

		selected.set(replacement);
		await microtask();
		expect(section.querySelector("button")).toBe(oldButton);
		expect(section.contains(newButton!)).toBe(false);
		expect(oldCleanup).toHaveBeenCalledOnce();
		expect(newCleanup).toHaveBeenCalledOnce();
		expect(Signal.subtle.introspectSinks(selected)).toHaveLength(0);
		expect(Signal.subtle.introspectSinks(oldValue)).toHaveLength(0);
		expect(Signal.subtle.introspectSinks(newValue)).toHaveLength(0);

		newButton!.click();
		expect(newClick).not.toHaveBeenCalled();
	});

	test("tracks inline nested dependencies through AUI suspension without replaying static writes", async () => {
		const disabled = new Signal.State(false);
		const label = new Signal.State("before");
		const writes: unknown[] = [];
		const nested = html`<input ${(element: Element) => {
			Object.defineProperty(element, "token", {
				set: (value) => writes.push(value),
			});
		}} .token=${"fixed"} .disabled=${disabled}><span>${label}</span>`;
		const selected = new Signal.State(nested);
		const element = create(
			class extends AUIElement {
				protected layout(): TemplateResult {
					return html`<section>${selected}</section>`;
				}
			},
		);

		document.body.append(element);
		const input = element.querySelector("input")!;
		const span = element.querySelector("span")!;
		expect(writes).toEqual(["fixed"]);
		expect(Signal.subtle.introspectSinks(selected)).toHaveLength(1);
		expect(Signal.subtle.introspectSinks(disabled)).toHaveLength(1);
		expect(Signal.subtle.introspectSinks(label)).toHaveLength(1);

		disabled.set(true);
		label.set("connected");
		await microtask();
		expect(input.disabled).toBe(true);
		expect(span.textContent).toBe("connected");
		expect(writes).toEqual(["fixed"]);

		element.remove();
		expect(Signal.subtle.introspectSinks(selected)).toHaveLength(0);
		expect(Signal.subtle.introspectSinks(disabled)).toHaveLength(0);
		expect(Signal.subtle.introspectSinks(label)).toHaveLength(0);
		disabled.set(false);
		label.set("detached");
		await microtask();
		expect(input.disabled).toBe(true);
		expect(span.textContent).toBe("connected");

		document.body.append(element);
		expect(element.querySelector("input")).toBe(input);
		expect(element.querySelector("span")).toBe(span);
		expect(input.disabled).toBe(false);
		expect(span.textContent).toBe("detached");
		expect(writes).toEqual(["fixed"]);
		expect(Signal.subtle.introspectSinks(selected)).toHaveLength(1);
		expect(Signal.subtle.introspectSinks(disabled)).toHaveLength(1);
		expect(Signal.subtle.introspectSinks(label)).toHaveLength(1);
	});

	test("keeps one active nested instance through repeated replacement", async () => {
		let active = 0;
		let maximumActive = 0;
		let setups = 0;
		let cleanups = 0;
		const values = [new Signal.State("A"), new Signal.State("B"), new Signal.State("C")];
		const descriptions = values.map(
			(value) =>
				html`<span ${() => {
					++setups;
					maximumActive = Math.max(maximumActive, ++active);

					return () => {
						--active;
						++cleanups;
					};
				}}>${value}</span>`,
		);
		const selected = new Signal.State(descriptions[0]!);
		const view = retain(createFragment(html`<section>${selected}</section>`, {}));

		expect(active).toBe(1);
		for (let index = 0; index < 30; ++index) {
			selected.set(descriptions[(index + 1) % descriptions.length]!);
			await microtask();
			expect(active).toBe(1);
			expect(values.reduce((count, value) => count + Signal.subtle.introspectSinks(value).length, 0)).toBe(1);
		}
		expect(setups).toBe(31);
		expect(cleanups).toBe(30);
		expect(maximumActive).toBeLessThanOrEqual(2);

		view.dispose();
		expect(active).toBe(0);
		expect(cleanups).toBe(31);
		expect(values.reduce((count, value) => count + Signal.subtle.introspectSinks(value).length, 0)).toBe(0);
	});

	test("keeps explicitly parked content alive and reusable outside finite nested ownership", async () => {
		const value = new Signal.State("before");
		const childView = retain(createFragment(html`<input .value=${"draft"}><span>${value}</span>`, {}));
		const input = childView.querySelector("input")!;
		const span = childView.querySelector("span")!;
		const region = new PersistentFragment(childView.childNodes);
		const content = new Signal.State<readonly PersistentFragment[]>([region]);
		const parent = retain(createFragment(html`<section>${content}</section>`, {}));
		const section = parent.querySelector("section")!;
		fixture(document.createElement("div")).append(parent);

		input.value = "unsaved draft";
		content.set([]);
		await microtask();
		expect(section.contains(input)).toBe(false);
		value.set("parked");
		await microtask();
		expect(span.textContent).toBe("parked");

		content.set([region]);
		await microtask();
		expect(section.querySelector("input")).toBe(input);
		expect(section.querySelector("span")).toBe(span);
		expect(input.value).toBe("unsaved draft");
		expect(Signal.subtle.introspectSinks(value)).toHaveLength(1);
	});
});
