import { Signal } from "@serve-tools/signal";
import { SignalArray } from "@serve-tools/signal-collections";
import { html, LitElement, nothing, render } from "lit";
import { describe, expect, it } from "vitest";
import { collection, property } from "../src/decorators.js";
import { choose, watch, when } from "../src/lit-signals.js";

class ConditionalTestElement extends LitElement {
	declare enabled: boolean;
	declare status: "idle" | "ready";
	declare items: string[];

	renders = 0;

	constructor() {
		super();

		enabledValues.set(this, initializeEnabled.call(this, false));
		statusValues.set(this, initializeStatus.call(this, "idle"));
		itemValues.set(this, initializeItems.call(this, ["first"]));
	}

	protected override render() {
		++this.renders;

		return html`
			${when(
				() => this.enabled,
				() => html`Enabled: ${this.items.length}`,
				() => html`Disabled`,
			)}
			${choose(
				() => this.status,
				[
					["idle", () => html`Idle`],
					["ready", () => html`Ready: ${this.items.join(",")}`],
				],
			)}
		`;
	}
}

const metadata = {};
const enabledValues = new WeakMap<object, boolean>();
const statusValues = new WeakMap<object, "idle" | "ready">();
const itemValues = new WeakMap<object, string[]>();

let initializeEnabled = identity<boolean>;
let initializeStatus = identity<"idle" | "ready">;
let initializeItems = identity<string[]>;

initializeEnabled = decorateAccessor("enabled", enabledValues, property<boolean>());
initializeStatus = decorateAccessor("status", statusValues, property<"idle" | "ready">());
initializeItems = decorateAccessor("items", itemValues, collection(SignalArray));

Object.defineProperty(ConditionalTestElement, Symbol.metadata, { value: metadata });

customElements.define("serve-tools-conditional-test", ConditionalTestElement);

function decorateAccessor<Value>(
	name: string,
	values: WeakMap<object, Value>,
	decorate: AccessorDecorator<Value>,
): (this: ConditionalTestElement, value: Value) => Value {
	const target: ClassAccessorDecoratorTarget<ConditionalTestElement, Value> = {
		get() {
			return values.get(this)!;
		},
		set(value) {
			values.set(this, value);
		},
	};
	const decorated = decorate(target, {
		kind: "accessor",
		name,
		static: false,
		private: false,
		access: {
			has(element) {
				return name in element;
			},
			get(element) {
				return Reflect.get(element, name) as Value;
			},
			set(element, value) {
				Reflect.set(element, name, value);
			},
		},
		addInitializer() {},
		metadata,
	});

	Object.defineProperty(ConditionalTestElement.prototype, name, {
		configurable: true,
		get: decorated.get ?? target.get,
		set: decorated.set ?? target.set,
	});

	return decorated.init ?? identity;
}

function identity<Value>(value: Value): Value {
	return value;
}

type AccessorDecorator<Value> = (
	target: ClassAccessorDecoratorTarget<ConditionalTestElement, Value>,
	context: ClassAccessorDecoratorContext<ConditionalTestElement, Value>,
) => ClassAccessorDecoratorResult<ConditionalTestElement, Value>;

describe("signal conditionals", () => {
	it("updates decorated properties and collections without rerendering the element", async () => {
		const element = new ConditionalTestElement();

		document.body.append(element);

		try {
			await element.updateComplete;

			expect(element.shadowRoot?.textContent).toContain("Disabled");
			expect(element.shadowRoot?.textContent).toContain("Idle");
			expect(element.renders).toBe(1);

			element.enabled = true;
			element.status = "ready";
			await Promise.resolve();

			expect(element.shadowRoot?.textContent).toContain("Enabled: 1");
			expect(element.shadowRoot?.textContent).toContain("Ready: first");
			expect(element.renders).toBe(1);

			element.items.push("second");
			await Promise.resolve();

			expect(element.shadowRoot?.textContent).toContain("Enabled: 2");
			expect(element.shadowRoot?.textContent).toContain("Ready: first,second");
			expect(element.renders).toBe(1);
		} finally {
			element.remove();
		}
	});

	it("tracks only the active when branch", async () => {
		const condition = new Signal.State(true);
		const primary = new Signal.State("primary");
		const secondary = new Signal.State("secondary");
		const container = document.createElement("div");
		let primaryReads = 0;
		let secondaryReads = 0;

		render(
			html`${when(
				condition,
				() => {
					++primaryReads;

					return primary.get();
				},
				() => {
					++secondaryReads;

					return secondary.get();
				},
			)}`,
			container,
		);

		secondary.set("ignored");
		await Promise.resolve();

		expect(container.textContent).toBe("primary");
		expect(primaryReads).toBe(1);
		expect(secondaryReads).toBe(0);

		condition.set(false);
		await Promise.resolve();

		expect(container.textContent).toBe("ignored");

		primary.set("still ignored");
		await Promise.resolve();

		expect(primaryReads).toBe(1);
		expect(secondaryReads).toBe(1);
	});

	it("chooses by strict equality and tracks only the selected case", async () => {
		const selected = new Signal.State<"first" | "second" | "missing">("first");
		const first = new Signal.State("one");
		const second = new Signal.State("two");
		const fallback = new Signal.State("other");
		const container = document.createElement("div");

		render(
			html`${choose(
				selected,
				[
					["first", () => first.get()],
					["second", () => second.get()],
				],
				(value) => `${value}:${fallback.get()}`,
			)}`,
			container,
		);

		second.set("ignored");
		fallback.set("ignored");
		await Promise.resolve();

		expect(container.textContent).toBe("one");

		selected.set("second");
		await Promise.resolve();

		expect(container.textContent).toBe("ignored");

		selected.set("missing");
		await Promise.resolve();

		expect(container.textContent).toBe("missing:ignored");
	});

	it("renders nothing for an unmatched condition without a fallback", async () => {
		const condition = new Signal.State(false);
		const selected = new Signal.State("missing");
		const container = document.createElement("div");

		render(
			html`${when(condition, () => "visible")}:${choose(selected, [["present", () => "selected"]])}`,
			container,
		);

		expect(container.textContent).toBe(":");

		condition.set(true);
		selected.set("present");
		await Promise.resolve();

		expect(container.textContent).toBe("visible:selected");

		render(nothing, container);
	});

	it("keeps nested watch dependencies out of the conditional", async () => {
		const condition = new Signal.State(true);
		const outer = new Signal.State("outer");
		const inner = new Signal.State("inner");
		const container = document.createElement("div");
		let branchReads = 0;

		render(
			html`${when(condition, () => {
				++branchReads;

				return html`${outer.get()}:${watch(inner)}`;
			})}`,
			container,
		);

		inner.set("inner update");
		await Promise.resolve();

		expect(container.textContent).toBe("outer:inner update");
		expect(branchReads).toBe(1);

		outer.set("outer update");
		await Promise.resolve();

		expect(container.textContent).toBe("outer update:inner update");
		expect(branchReads).toBe(2);
	});

	it("disconnects and reconnects conditional subscriptions", () => {
		const condition = new Signal.State(true);
		const container = document.createElement("div");
		const part = render(
			html`${when(
				condition,
				() => "yes",
				() => "no",
			)}`,
			container,
		);

		expect(Signal.subtle.hasSinks(condition)).toBe(true);

		part.setConnected(false);
		condition.set(false);

		expect(Signal.subtle.hasSinks(condition)).toBe(false);
		expect(container.textContent).toBe("yes");

		part.setConnected(true);

		expect(Signal.subtle.hasSinks(condition)).toBe(true);
		expect(container.textContent).toBe("no");
	});

	it("switches conditional signal sources", async () => {
		const first = new Signal.State<string | null>("first");
		const second = new Signal.State<string | null>(null);
		const container = document.createElement("div");
		const template = (source: Signal.Any<string | null>) =>
			html`${when(
				source,
				(value) => value,
				() => "no",
			)}`;

		render(template(first), container);
		render(template(second), container);

		first.set("ignored");
		await Promise.resolve();

		expect(container.textContent).toBe("no");

		second.set("second");
		await Promise.resolve();

		expect(container.textContent).toBe("second");
	});

	it("batches watch, when, and choose updates in one shared microtask", () => {
		const source = new Signal.State(true);
		const container = document.createElement("div");
		const queuedMicrotasks: VoidFunction[] = [];
		const queueMicrotask = globalThis.queueMicrotask;

		render(
			html`
				${watch(source)}
				${when(
					source,
					() => "yes",
					() => "no",
				)}
				${choose(source, [
					[true, () => "yes"],
					[false, () => "no"],
				])}
			`,
			container,
		);

		globalThis.queueMicrotask = (callback) => queuedMicrotasks.push(callback);

		try {
			source.set(false);

			expect(queuedMicrotasks).toHaveLength(1);
		} finally {
			globalThis.queueMicrotask = queueMicrotask;

			for (const callback of queuedMicrotasks) {
				callback();
			}

			render(nothing, container);
		}
	});
});
