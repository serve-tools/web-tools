import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	installCustomElementRegistry,
	supportsCustomElementRegistry,
} from "../src/ponyfill-custom-element-registry.js";

let frame: HTMLIFrameElement;
let win: Window & typeof globalThis;

beforeEach(() => {
	frame = document.createElement("iframe");
	document.body.append(frame);
	win = frame.contentWindow as Window & typeof globalThis;
});

afterEach(() => frame.remove());

it("imports without patching the target realm", async () => {
	const registry = win.CustomElementRegistry;
	const elements = win.customElements;
	const createElement = win.Document.prototype.createElement;
	const htmlElement = win.HTMLElement;
	await new Promise<void>((resolve, reject) => {
		const script = win.document.createElement("script");
		script.type = "module";
		script.src = new URL("../src/ponyfill-custom-element-registry.ts", import.meta.url).href;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Failed to import ponyfill"));
		win.document.head.append(script);
	});

	expect(win.CustomElementRegistry).toBe(registry);
	expect(win.customElements === elements).toBe(true);
	expect(win.Document.prototype.createElement).toBe(createElement);
	expect(win.HTMLElement).toBe(htmlElement);
});

it("probes capabilities without changing constructors or DOM methods", () => {
	const registry = win.CustomElementRegistry;
	const elements = win.customElements;
	const createElement = win.Document.prototype.createElement;
	const attachShadow = win.Element.prototype.attachShadow;

	expect(supportsCustomElementRegistry(win)).toBeTypeOf("boolean");
	expect(win.CustomElementRegistry).toBe(registry);
	expect(win.customElements).toBe(elements);
	expect(win.Document.prototype.createElement).toBe(createElement);
	expect(win.Element.prototype.attachShadow).toBe(attachShadow);
});

it("installs once and confines patches to the selected realm", () => {
	const outerRegistry = globalThis.CustomElementRegistry;
	const outerCreateElement = Document.prototype.createElement;
	const installation = installCustomElementRegistry(win);
	const createElement = win.Document.prototype.createElement;

	expect(installCustomElementRegistry(win)).toBe(installation);
	expect(win.CustomElementRegistry).toBe(installation.CustomElementRegistry);
	expect(win.customElements).toBe(installation.customElements);
	expect(win.Document.prototype.createElement).toBe(createElement);
	expect(globalThis.CustomElementRegistry).toBe(outerRegistry);
	expect(Document.prototype.createElement).toBe(outerCreateElement);
});

it("preserves definitions registered before installation", async () => {
	class Existing extends win.HTMLElement {}
	win.customElements.define("x-existing", Existing);
	installCustomElementRegistry(win);

	expect(win.customElements.get("x-existing")).toBe(Existing);
	expect(win.customElements.getName(Existing)).toBe("x-existing");
	await expect(win.customElements.whenDefined("x-existing")).resolves.toBe(Existing);
	const element = win.document.createElement("x-existing");
	const container = win.document.createElement("div");
	container.innerHTML = "<x-existing></x-existing>";

	expect(element).toBeInstanceOf(Existing);
	expect(container.firstElementChild).toBeInstanceOf(Existing);
	expect(element.cloneNode()).toBeInstanceOf(Existing);
	expect(win.document.importNode(element)).toBeInstanceOf(Existing);
});

it("supports global definitions when the native registry has no getName method", () => {
	Reflect.deleteProperty(win.CustomElementRegistry.prototype, "getName");
	installCustomElementRegistry(win);
	class Global extends win.HTMLElement {}
	win.customElements.define("x-global", Global);

	expect(win.customElements.get("x-global")).toBe(Global);
	expect(win.customElements.getName(Global)).toBe("x-global");
	expect(win.document.createElement("x-global")).toBeInstanceOf(Global);
});

describe("fallback registries", () => {
	beforeEach(() => installCustomElementRegistry(win));

	it("isolates colliding definitions and preserves constructor identity", async () => {
		const first = new win.CustomElementRegistry();
		const second = new win.CustomElementRegistry();
		class First extends win.HTMLElement {}
		class Second extends win.HTMLElement {}
		const pending = first.whenDefined("x-shared");

		first.define("x-shared", First);
		second.define("x-shared", Second);

		await expect(pending).resolves.toBe(First);
		expect(first.get("x-shared")).toBe(First);
		expect(second.get("x-shared")).toBe(Second);
		expect(first.getName(First)).toBe("x-shared");
		expect(first.getName(Second)).toBeNull();
		expect(win.customElements.get("x-shared")).toBeUndefined();
		const one = win.document.createElement("x-shared", { customElementRegistry: first });
		const two = win.document.createElement("x-shared", { customElementRegistry: second });

		expect(one).toBeInstanceOf(First);
		expect(two).toBeInstanceOf(Second);
		expect(one.ownerDocument).toBe(win.document);
		expect(one.customElementRegistry === first).toBe(true);
		expect(two.customElementRegistry === second).toBe(true);
	});

	it("rejects duplicate definitions without corrupting subsequent registration", () => {
		const registry = new win.CustomElementRegistry();
		class First extends win.HTMLElement {}
		class Second extends win.HTMLElement {}

		registry.define("x-first", First);
		expect(() => registry.define("x-first", Second)).toThrow();
		expect(() => registry.define("x-second", First)).toThrow();
		expect(() => registry.define("invalid", Second)).toThrow();
		registry.define("x-second", Second);
		expect(registry.get("x-second")).toBe(Second);
	});

	it("parses a shadow tree with its registry and retains it through cloning", () => {
		const registry = new win.CustomElementRegistry();
		class Scoped extends win.HTMLElement {}
		registry.define("x-scoped", Scoped);
		const host = win.document.createElement("div");
		const root = host.attachShadow({ mode: "open", customElementRegistry: registry });

		root.innerHTML = "<section><x-scoped data-source='parsed'></x-scoped></section>";
		const element = root.querySelector("x-scoped")!;
		const clone = element.cloneNode(true) as HTMLElement;

		expect(root.customElementRegistry === registry).toBe(true);
		expect(element).toBeInstanceOf(Scoped);
		expect(clone).toBeInstanceOf(Scoped);
		expect(clone.customElementRegistry === registry).toBe(true);
		expect(clone.getAttribute("data-source")).toBe("parsed");
		expect(clone.ownerDocument).toBe(win.document);
	});

	it("uses scoped definitions in adjacent HTML, outerHTML, and contextual fragments", () => {
		const registry = new win.CustomElementRegistry();
		class Scoped extends win.HTMLElement {}
		registry.define("x-scoped", Scoped);
		const container = win.document.createElement("section", { customElementRegistry: registry });

		container.insertAdjacentHTML("beforeend", "<x-scoped></x-scoped>");
		expect(container.firstElementChild).toBeInstanceOf(Scoped);
		container.firstElementChild!.outerHTML = "<x-scoped data-replaced></x-scoped>";
		expect(container.firstElementChild).toBeInstanceOf(Scoped);
		expect(container.firstElementChild!.hasAttribute("data-replaced")).toBe(true);
		const range = win.document.createRange();
		range.selectNodeContents(container);
		const fragment = range.createContextualFragment("<x-scoped></x-scoped>");

		expect(fragment.firstElementChild).toBeInstanceOf(Scoped);
	});

	it("upgrades connected candidates when a definition arrives", () => {
		const registry = new win.CustomElementRegistry();
		const host = win.document.createElement("div");
		const root = host.attachShadow({ mode: "open", customElementRegistry: registry });
		root.innerHTML = "<x-later></x-later>";
		win.document.body.append(host);
		const element = root.firstElementChild!;
		let constructions = 0;
		const events: string[] = [];
		class Later extends win.HTMLElement {
			constructor() {
				super();
				++constructions;
			}

			connectedCallback() {
				events.push("connected");
			}

			disconnectedCallback() {
				events.push("disconnected");
			}

			adoptedCallback() {
				events.push("adopted");
			}
		}

		registry.define("x-later", Later);

		expect(root.firstElementChild).toBe(element);
		expect(element).toBeInstanceOf(Later);
		expect(constructions).toBe(1);
		expect(events).toEqual(["connected"]);
	});

	it("keeps template content inert and imports it into a selected registry", () => {
		const registry = new win.CustomElementRegistry();
		class Scoped extends win.HTMLElement {}
		registry.define("x-scoped", Scoped);
		const template = win.document.createElement("template");
		template.innerHTML = "<x-scoped></x-scoped>";

		expect(template.content.firstElementChild!.customElementRegistry === null).toBe(true);
		expect(template.content.firstElementChild).not.toBeInstanceOf(Scoped);
		const fragment = win.document.importNode(template.content, { customElementRegistry: registry });

		expect(fragment.firstElementChild).toBeInstanceOf(Scoped);
		expect(fragment.firstElementChild!.customElementRegistry === registry).toBe(true);
		expect(template.content.firstElementChild).not.toBeInstanceOf(Scoped);
	});

	it("upgrades detached candidates explicitly and only once", () => {
		const registry = new win.CustomElementRegistry();
		const element = win.document.createElement("x-later", { customElementRegistry: registry });
		let constructions = 0;
		class Later extends win.HTMLElement {
			constructor() {
				super();
				++constructions;
			}
		}
		registry.define("x-later", Later);

		registry.upgrade(element);
		registry.upgrade(element);

		expect(element).toBeInstanceOf(Later);
		expect(constructions).toBe(1);
	});

	it("retains an explicitly different registry across insertion and upgrade", () => {
		const first = new win.CustomElementRegistry();
		const second = new win.CustomElementRegistry();
		class First extends win.HTMLElement {}
		class Second extends win.HTMLElement {}
		const container = win.document.createElement("div", { customElementRegistry: first });
		const element = win.document.createElement("x-shared", { customElementRegistry: second });
		container.append(element);
		first.define("x-shared", First);
		second.define("x-shared", Second);

		first.upgrade(container);
		expect(element).not.toBeInstanceOf(First);
		second.upgrade(element);
		expect(element).toBeInstanceOf(Second);
		expect(element.customElementRegistry === second).toBe(true);
		expect(element.parentNode).toBe(container);
	});

	it("does not upgrade candidates when insertion references fail validation", () => {
		const registry = new win.CustomElementRegistry();
		const container = win.document.createElement("div", { customElementRegistry: registry });
		const inserted = win.document.createElement("x-invalid-insertion", { customElementRegistry: registry });
		const replaced = win.document.createElement("x-invalid-replacement", { customElementRegistry: registry });
		const unrelated = win.document.createElement("span");
		let constructions = 0;
		class Inserted extends win.HTMLElement {
			constructor() {
				super();
				++constructions;
			}
		}
		class Replaced extends win.HTMLElement {
			constructor() {
				super();
				++constructions;
			}
		}
		registry.define("x-invalid-insertion", Inserted);
		registry.define("x-invalid-replacement", Replaced);

		expect(() => container.insertBefore(inserted, unrelated)).toThrowError(win.DOMException);
		expect(() => container.replaceChild(replaced, unrelated)).toThrowError(win.DOMException);

		expect(constructions).toBe(0);
		expect(inserted).not.toBeInstanceOf(Inserted);
		expect(replaced).not.toBeInstanceOf(Replaced);
	});

	it("supports nullish insertBefore references and preserves missing-argument validation", () => {
		const registry = new win.CustomElementRegistry();
		const container = win.document.createElement("div", { customElementRegistry: registry });
		const first = win.document.createElement("x-nullish-insertion", { customElementRegistry: registry });
		const second = win.document.createElement("x-nullish-insertion", { customElementRegistry: registry });
		const missing = win.document.createElement("x-missing-reference", { customElementRegistry: registry });
		let nullishConstructions = 0;
		let missingConstructions = 0;
		class Nullish extends win.HTMLElement {
			constructor() {
				super();
				++nullishConstructions;
			}
		}
		class Missing extends win.HTMLElement {
			constructor() {
				super();
				++missingConstructions;
			}
		}
		registry.define("x-nullish-insertion", Nullish);
		registry.define("x-missing-reference", Missing);

		container.insertBefore(first, null);
		Reflect.apply(container.insertBefore, container, [second, undefined]);
		expect(() => Reflect.apply(container.insertBefore, container, [missing])).toThrowError(win.TypeError);

		expect([...container.children]).toEqual([first, second]);
		expect(first).toBeInstanceOf(Nullish);
		expect(second).toBeInstanceOf(Nullish);
		expect(nullishConstructions).toBe(2);
		expect(missingConstructions).toBe(0);
		expect(missing).not.toBeInstanceOf(Missing);
	});

	it("preflights every candidate before a multi-node insertion", () => {
		const registry = new win.CustomElementRegistry();
		const container = win.document.createElement("div", { customElementRegistry: registry });
		const candidate = win.document.createElement("x-before-cycle", { customElementRegistry: registry });
		let constructions = 0;
		class Scoped extends win.HTMLElement {
			constructor() {
				super();
				++constructions;
			}
		}
		registry.define("x-before-cycle", Scoped);

		expect(() => container.append(candidate, container)).toThrowError(win.DOMException);

		expect(constructions).toBe(0);
		expect(candidate).not.toBeInstanceOf(Scoped);
	});

	it("keeps null-registry content inert until initialize assigns a registry", () => {
		const registry = new win.CustomElementRegistry();
		class Scoped extends win.HTMLElement {}
		registry.define("x-scoped", Scoped);
		const host = win.document.createElement("div");
		const root = host.attachShadow({ mode: "open", customElementRegistry: null });
		root.innerHTML = "<x-scoped></x-scoped>";
		const element = root.firstElementChild!;

		expect(element).not.toBeInstanceOf(Scoped);
		expect(element.customElementRegistry === null).toBe(true);
		registry.initialize(root);
		expect(element instanceof Scoped).toBe(true);
		expect(element.customElementRegistry === registry).toBe(true);
		expect(root.customElementRegistry === registry).toBe(true);
	});

	it("preserves the global registry of trees created before installation", () => {
		const frame2 = document.createElement("iframe");
		document.body.append(frame2);
		const win2 = frame2.contentWindow as Window & typeof globalThis;
		const container = win2.document.createElement("div");
		container.innerHTML = "<x-before-install></x-before-install>";

		try {
			installCustomElementRegistry(win2);
			const registry = new win2.CustomElementRegistry();
			class Scoped extends win2.HTMLElement {}
			registry.define("x-before-install", Scoped);

			registry.initialize(container);
			registry.upgrade(container);

			expect(container.customElementRegistry === win2.customElements).toBe(true);
			expect(container.firstElementChild!.customElementRegistry === win2.customElements).toBe(true);
			expect(container.firstElementChild).not.toBeInstanceOf(Scoped);
		} finally {
			frame2.remove();
		}
	});

	it("delivers observable lifecycle callbacks without internal adoption callbacks", () => {
		const registry = new win.CustomElementRegistry();
		const events: string[] = [];
		class Tracked extends win.HTMLElement {
			static observedAttributes = ["data-state"];

			connectedCallback() {
				events.push("connected");
			}

			disconnectedCallback() {
				events.push("disconnected");
			}

			adoptedCallback() {
				events.push("adopted");
			}

			attributeChangedCallback(name: string, oldValue: string | null, value: string | null) {
				events.push(`${name}:${oldValue}:${value}`);
			}
		}
		registry.define("x-tracked", Tracked);
		const element = win.document.createElement("x-tracked", { customElementRegistry: registry });

		expect(events).toEqual([]);
		win.document.body.append(element);
		element.setAttribute("data-state", "ready");
		element.remove();
		expect(events).toEqual(["connected", "data-state:null:ready", "disconnected"]);
	});

	it("allows direct construction of globally registered elements", () => {
		const registry = win.customElements;
		class Global extends win.HTMLElement {}
		registry.define("x-global", Global);

		expect(win.document.createElement("x-global")).toBeInstanceOf(Global);
		expect(new Global()).toBeInstanceOf(Global);
	});

	it("synchronously upgrades newly registered global elements when parsed or copied", () => {
		class Global extends win.HTMLElement {}
		win.customElements.define("x-global", Global);
		const container = win.document.createElement("div");
		container.innerHTML = "<x-global></x-global>";
		const element = container.firstElementChild!;

		expect(element instanceof Global).toBe(true);
		expect(element.cloneNode() instanceof Global).toBe(true);
		expect(win.document.importNode(element) instanceof Global).toBe(true);
		container.insertAdjacentHTML("beforeend", "<x-global></x-global>");
		expect(container.lastElementChild instanceof Global).toBe(true);
	});
});
