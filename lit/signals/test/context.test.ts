import { ContextConsumer as LitContextConsumer, ContextProvider as LitContextProvider } from "@lit/context";
import { html, LitElement } from "lit";
import { describe, expect, it } from "vitest";
import { consume, provide, refreshContexts } from "../src/decorators.js";
import { ContextConsumer, ContextProvider, ContextRoot, createContext, Signal, watch } from "../src/lit-signals.js";

interface Theme {
	name: string;
}

const themeContext = createContext<Theme>(Symbol("theme"));
const providerValues = new WeakMap<ThemeProvider, Theme>();
const providerInitializers: Array<(this: ThemeProvider) => void> = [];
const consumerValues = new WeakMap<ThemeConsumer, Theme>();
const consumerInitializers: Array<(this: ThemeConsumer) => void> = [];
const oneShotValues = new WeakMap<OneShotConsumer, Theme>();
const oneShotInitializers: Array<(this: OneShotConsumer) => void> = [];

let initializeProvider: (this: ThemeProvider, value: Theme) => Theme;
let initializeConsumer: (this: ThemeConsumer, value: Theme) => Theme;
let initializeOneShot: (this: OneShotConsumer, value: Theme) => Theme;

class ThemeProvider extends LitElement {
	declare theme: Theme;
	renders = 0;

	constructor() {
		super();

		providerValues.set(this, initializeProvider.call(this, { name: "provided" }));

		for (const initialize of providerInitializers) {
			initialize.call(this);
		}
	}

	protected override render() {
		++this.renders;

		return html`<slot></slot>`;
	}
}

class ThemeConsumer extends LitElement {
	declare theme: Theme;
	renders = 0;

	constructor() {
		super();

		consumerValues.set(this, initializeConsumer.call(this, { name: "fallback" }));

		for (const initialize of consumerInitializers) {
			initialize.call(this);
		}
	}

	protected override render() {
		++this.renders;

		return html`${watch(() => this.theme.name)}`;
	}
}

class OneShotConsumer extends LitElement {
	declare theme: Theme;

	constructor() {
		super();

		oneShotValues.set(this, initializeOneShot.call(this, { name: "fallback" }));

		for (const initialize of oneShotInitializers) {
			initialize.call(this);
		}
	}
}

initializeProvider = decorateAccessor(
	ThemeProvider.prototype,
	"theme",
	providerValues,
	provide({ context: themeContext }),
	providerInitializers,
);
initializeConsumer = decorateAccessor(
	ThemeConsumer.prototype,
	"theme",
	consumerValues,
	consume({ context: themeContext, subscribe: true }),
	consumerInitializers,
);
initializeOneShot = decorateAccessor(
	OneShotConsumer.prototype,
	"theme",
	oneShotValues,
	consume({ context: themeContext }),
	oneShotInitializers,
);

customElements.define("serve-tools-context-provider", ThemeProvider);
customElements.define("serve-tools-context-consumer", ThemeConsumer);
customElements.define("serve-tools-context-one-shot", OneShotConsumer);

interface LifecycleChange {
	name: PropertyKey;
	oldValue: unknown;
}

const lifecycleProviderValues = new WeakMap<LifecycleProvider, Theme>();
const lifecycleProviderInitializers: Array<(this: LifecycleProvider) => void> = [];
const lifecycleConsumerValues = new WeakMap<LifecycleConsumer, Theme>();
const lifecycleConsumerInitializers: Array<(this: LifecycleConsumer) => void> = [];

let initializeLifecycleProvider: (this: LifecycleProvider, value: Theme) => Theme;
let initializeLifecycleConsumer: (this: LifecycleConsumer, value: Theme) => Theme;

class LifecycleProvider extends LitElement {
	declare theme: Theme;
	readonly changes: LifecycleChange[] = [];

	constructor() {
		super();

		lifecycleProviderValues.set(this, initializeLifecycleProvider.call(this, { name: "provided" }));

		for (const initialize of lifecycleProviderInitializers) {
			initialize.call(this);
		}
	}

	protected override updated(changedProperties: Map<PropertyKey, unknown>): void {
		for (const [name, oldValue] of changedProperties) {
			this.changes.push({ name, oldValue });
		}
	}

	protected override render() {
		return this.theme.name;
	}
}

class LifecycleConsumer extends LitElement {
	declare theme: Theme;
	readonly changes: LifecycleChange[] = [];

	constructor() {
		super();

		lifecycleConsumerValues.set(this, initializeLifecycleConsumer.call(this, { name: "fallback" }));

		for (const initialize of lifecycleConsumerInitializers) {
			initialize.call(this);
		}
	}

	protected override updated(changedProperties: Map<PropertyKey, unknown>): void {
		for (const [name, oldValue] of changedProperties) {
			this.changes.push({ name, oldValue });
		}
	}

	protected override render() {
		return this.theme.name;
	}
}

initializeLifecycleProvider = decorateAccessor(
	LifecycleProvider.prototype,
	"theme",
	lifecycleProviderValues,
	provide({ context: themeContext, update: "lifecycle" }),
	lifecycleProviderInitializers,
);
initializeLifecycleConsumer = decorateAccessor(
	LifecycleConsumer.prototype,
	"theme",
	lifecycleConsumerValues,
	consume({ context: themeContext, subscribe: true, update: "lifecycle" }),
	lifecycleConsumerInitializers,
);

customElements.define("serve-tools-context-lifecycle-provider", LifecycleProvider);
customElements.define("serve-tools-context-lifecycle-consumer", LifecycleConsumer);

describe("context decorators", () => {
	it("tracks provided and consumed values without rerendering either host", async () => {
		const provider = new ThemeProvider();
		const consumer = new ThemeConsumer();

		expect(consumer.theme).toEqual({ name: "fallback" });

		provider.append(consumer);
		document.body.append(provider);

		try {
			await Promise.all([provider.updateComplete, consumer.updateComplete]);

			const uppercaseName = new Signal.Computed(() => consumer.theme.name.toUpperCase());

			expect(consumer.theme).toBe(provider.theme);
			expect(consumer.shadowRoot?.textContent).toBe("provided");
			expect(uppercaseName.get()).toBe("PROVIDED");
			expect(provider.renders).toBe(1);
			expect(consumer.renders).toBe(1);

			provider.theme = { name: "updated" };
			await Promise.resolve();

			expect(consumer.shadowRoot?.textContent).toBe("updated");
			expect(uppercaseName.get()).toBe("UPDATED");
			expect(provider.renders).toBe(1);
			expect(consumer.renders).toBe(1);
		} finally {
			provider.remove();
		}
	});

	it("keeps consumed accessors read-only without inspecting assigned values", () => {
		const consumer = new ThemeConsumer();
		const cyclicTheme = { name: "cyclic" } as Theme & { self?: unknown };

		cyclicTheme.self = cyclicTheme;

		expect(() => {
			consumer.theme = cyclicTheme;
		}).toThrowError("Cannot assign to consumed context property theme.");
	});

	it("refreshes a one-shot consumer when it reconnects under another provider", () => {
		const firstProvider = new ThemeProvider();
		const secondProvider = new ThemeProvider();
		const consumer = new OneShotConsumer();

		firstProvider.theme = { name: "first" };
		secondProvider.theme = { name: "second" };

		firstProvider.append(consumer);
		document.body.append(firstProvider, secondProvider);

		try {
			expect(consumer.theme.name).toBe("first");

			secondProvider.append(consumer);

			expect(consumer.theme.name).toBe("second");
		} finally {
			firstProvider.remove();
			secondProvider.remove();
		}
	});

	it("releases subscriptions while disconnected and restores them on reconnection", () => {
		const provider = new ThemeProvider();
		const consumer = new ThemeConsumer();

		provider.append(consumer);
		document.body.append(provider);

		try {
			expect(consumer.theme.name).toBe("provided");

			consumer.remove();
			provider.theme = { name: "disconnected" };

			expect(consumer.theme.name).toBe("provided");

			provider.append(consumer);

			expect(consumer.theme.name).toBe("disconnected");

			provider.theme = { name: "reconnected" };

			expect(consumer.theme.name).toBe("reconnected");
		} finally {
			provider.remove();
		}
	});

	it("reannounces a refreshed provider without interrupting its active subscriptions", () => {
		const provider = new ThemeProvider();
		const consumerHost = document.createElement("span");
		const values: Theme[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context: themeContext,
			subscribe: true,
			callback: (value) => values.push(value),
		});

		provider.append(consumerHost);
		document.body.append(provider);
		consumer.connect();

		try {
			expect(values).toEqual([provider.theme]);

			refreshContexts(provider);

			expect(values).toEqual([provider.theme]);
		} finally {
			consumer.disconnect();
			provider.remove();
		}
	});

	it("reports named changes in lifecycle mode", async () => {
		const provider = new LifecycleProvider();
		const consumer = new LifecycleConsumer();

		provider.append(consumer);
		document.body.append(provider);

		try {
			await Promise.all([provider.updateComplete, consumer.updateComplete]);

			provider.changes.length = 0;
			consumer.changes.length = 0;

			const oldTheme = provider.theme;
			provider.theme = { name: "updated" };

			await Promise.all([provider.updateComplete, consumer.updateComplete]);

			expect(provider.shadowRoot?.textContent).toBe("updated");
			expect(consumer.shadowRoot?.textContent).toBe("updated");
			expect(provider.changes).toContainEqual({ name: "theme", oldValue: oldTheme });
			expect(consumer.changes).toContainEqual({ name: "theme", oldValue: oldTheme });
		} finally {
			provider.remove();
		}
	});

	it("provides plain values to standard context consumers", () => {
		const provider = new ThemeProvider();
		const consumer = new StandardConsumer();

		provider.append(consumer);
		document.body.append(provider);

		try {
			expect(consumer.theme.value).toBe(provider.theme);
			expect(Signal.isState(consumer.theme.value)).toBe(false);
		} finally {
			provider.remove();
		}
	});

	it("consumes plain values from standard Lit context providers", () => {
		const provider = new StandardProvider();
		const consumer = new ThemeConsumer();

		provider.append(consumer);
		document.body.append(provider);

		try {
			expect(consumer.theme).toBe(provider.theme.value);

			provider.theme.setValue({ name: "standard-updated" });

			expect(consumer.theme.name).toBe("standard-updated");
		} finally {
			provider.remove();
		}
	});

	it("replays an unanswered standard Lit subscription when an owned provider connects later", () => {
		const rootHost = document.createElement("main");
		const providerHost = document.createElement("section");
		const consumer = new StandardConsumer();
		const root = new ContextRoot(rootHost);
		const provider = new ContextProvider(providerHost, { context: themeContext, initialValue: { name: "late" } });

		providerHost.append(consumer);
		rootHost.append(providerHost);
		document.body.append(rootHost);

		try {
			expect(consumer.theme.value).toBeUndefined();

			provider.connect();

			expect(consumer.theme.value).toEqual({ name: "late" });
		} finally {
			provider.disconnect();
			root.destroy();
			rootHost.remove();
		}
	});
});

class StandardConsumer extends LitElement {
	readonly theme = new LitContextConsumer(this, { context: themeContext, subscribe: true });
}

customElements.define("serve-tools-context-standard-consumer", StandardConsumer);

class StandardProvider extends LitElement {
	readonly theme = new LitContextProvider(this, { context: themeContext, initialValue: { name: "standard" } });

	protected override render() {
		return html`<slot></slot>`;
	}
}

customElements.define("serve-tools-context-standard-provider", StandardProvider);

function decorateAccessor<This extends LitElement, Value>(
	prototype: This,
	name: string,
	values: WeakMap<This, Value>,
	decorate: AccessorDecorator<This, Value>,
	initializers: Array<(this: This) => void>,
): (this: This, value: Value) => Value {
	const target: ClassAccessorDecoratorTarget<This, Value> = {
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
		addInitializer(initializer) {
			initializers.push(initializer);
		},
		metadata: {},
	});

	Object.defineProperty(prototype, name, {
		configurable: true,
		get: decorated.get ?? target.get,
		set: decorated.set ?? target.set,
	});

	return decorated.init ?? identity;
}

function identity<This, Value>(this: This, value: Value): Value {
	return value;
}

type AccessorDecorator<This extends LitElement, Value> = (
	target: ClassAccessorDecoratorTarget<This, Value>,
	context: ClassAccessorDecoratorContext<This, Value>,
) => ClassAccessorDecoratorResult<This, Value>;
