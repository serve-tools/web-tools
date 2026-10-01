/** The scoped-registry methods that are not present in older DOM declaration libraries. */
export interface ScopedCustomElementRegistry extends CustomElementRegistry {
	getName(constructor: CustomElementConstructor): string | null;
	initialize(root: Node): void;
}

/** A constructible `CustomElementRegistry` global. */
export interface CustomElementRegistryConstructor {
	readonly prototype: ScopedCustomElementRegistry;
	new (): ScopedCustomElementRegistry;
}

/** The globals installed by {@link installCustomElementRegistry}. */
export interface CustomElementRegistryInstallation {
	CustomElementRegistry: CustomElementRegistryConstructor;
	customElements: ScopedCustomElementRegistry;
}

type RegistryWindow = Window &
	typeof globalThis & {
		CustomElementRegistry: CustomElementRegistryConstructor;
		customElements: CustomElementRegistry;
	};

type NativeCustomElementRegistry = CustomElementRegistry & {
	getName?(constructor: CustomElementConstructor): string | null;
};

interface RegistryState {
	realm: RegistryWindow;
	document: Document;
	native: NativeCustomElementRegistry;
	defining: CustomElementConstructor | boolean;
}

type RegistryAssociation = ScopedCustomElementRegistry | null;
type HTMLElementConstructor = typeof HTMLElement;
type ElementCreationOptionsWithRegistry = ElementCreationOptions & {
	customElementRegistry?: RegistryAssociation;
};
type ShadowRootInitWithRegistry = ShadowRootInit & {
	customElementRegistry?: RegistryAssociation;
	customElements?: RegistryAssociation;
	registry?: RegistryAssociation;
};
type ShadowRootExtensions = ShadowRoot & {
	createElement(name: string, options?: ElementCreationOptionsWithRegistry): HTMLElement;
	createElementNS(namespace: string | null, name: string, options?: ElementCreationOptionsWithRegistry): Element;
	customElementRegistry: RegistryAssociation;
	customElements: RegistryAssociation;
	importNode<T extends Node>(node: T, deep?: boolean): T;
	registry: RegistryAssociation;
};
type ImportNodeOptionsWithRegistry = {
	customElementRegistry?: RegistryAssociation;
	selfOnly?: boolean;
};

interface InternalInstallation extends CustomElementRegistryInstallation {
	states: WeakMap<ScopedCustomElementRegistry, RegistryState>;
}

const asRegistryWindow = (value: typeof globalThis): RegistryWindow => value as unknown as RegistryWindow;
const installationSymbol = /* @__PURE__ */ Symbol.for("@serve-tools/custom-element-registry/installation");

const isRegistryWindow = (value: typeof globalThis): value is RegistryWindow => {
	const candidate = value as Partial<RegistryWindow>;

	return Boolean(
		candidate.document &&
			candidate.Node &&
			candidate.Element &&
			candidate.Document &&
			candidate.DocumentFragment &&
			candidate.ShadowRoot &&
			candidate.Range &&
			candidate.HTMLElement &&
			candidate.customElements,
	);
};

/** Tests whether a global already has the complete native scoped-registry API used by this package. */
export const supportsCustomElementRegistry = (win: typeof globalThis = globalThis): boolean => {
	if (!isRegistryWindow(win) || typeof win.CustomElementRegistry !== "function") {
		return false;
	}

	if ((win as unknown as Record<PropertyKey, unknown>)[installationSymbol]) {
		return true;
	}

	const prototype = win.CustomElementRegistry.prototype;

	if (typeof prototype.initialize !== "function" || typeof prototype.getName !== "function") {
		return false;
	}

	try {
		const customElements = new win.CustomElementRegistry();
		const element = win.document.createElement("div", {
			customElementRegistry: customElements,
		} as ElementCreationOptions);
		const host = win.document.createElement("div");
		const shadowRoot = host.attachShadow({
			mode: "open",
			customElementRegistry: customElements,
		} as ShadowRootInit);

		return (
			(element as Element & { customElementRegistry?: CustomElementRegistry }).customElementRegistry ===
				customElements &&
			(shadowRoot as ShadowRoot & { customElementRegistry?: CustomElementRegistry }).customElementRegistry ===
				customElements
		);
	} catch {
		return false;
	}
};

/** Installs the iframe-backed scoped `CustomElementRegistry` implementation into a browser global. */
export function installCustomElementRegistry(value: typeof globalThis = globalThis): CustomElementRegistryInstallation {
	if (!isRegistryWindow(value)) {
		throw new TypeError("CustomElementRegistry requires a browser global with native custom elements");
	}

	const win = asRegistryWindow(value);
	const installed = installationSymbol;
	const installedValue = (win as unknown as Record<PropertyKey, unknown>)[installed];

	if (installedValue) {
		return installedValue as CustomElementRegistryInstallation;
	}
	const { document: document2, Node, Element, Document, DocumentFragment, ShadowRoot, Range } = win;
	const descriptor = Object.getOwnPropertyDescriptor;
	const requiredDescriptor = (object: object, name: PropertyKey): PropertyDescriptor => {
		const result = descriptor(object, name);

		if (!result) {
			throw new TypeError(`Missing DOM property ${String(name)}`);
		}

		return result;
	};
	const native = {
		create: Document.prototype.createElement,
		createNS: Document.prototype.createElementNS,
		import: Document.prototype.importNode,
		adopt: Document.prototype.adoptNode,
		clone: Node.prototype.cloneNode,
		append: Node.prototype.appendChild,
		insert: Node.prototype.insertBefore,
		replace: Node.prototype.replaceChild,
		remove: Node.prototype.removeChild,
		attach: Element.prototype.attachShadow,
		html: requiredDescriptor(Element.prototype, "innerHTML"),
		shadowHTML: requiredDescriptor(ShadowRoot.prototype, "innerHTML"),
		outerHTML: requiredDescriptor(Element.prototype, "outerHTML"),
		rangeFragment: Range.prototype.createContextualFragment,
		matches: Element.prototype.matches,
		replaceChildren: Element.prototype.replaceChildren,
		fragmentReplaceChildren: DocumentFragment.prototype.replaceChildren,
	};
	const associations = /* @__PURE__ */ new WeakMap<Node, RegistryAssociation>();
	const shadows = /* @__PURE__ */ new WeakMap<Element, ShadowRoot>();
	const nullShadows = /* @__PURE__ */ new WeakSet<ShadowRoot>();
	const prototypeMap = /* @__PURE__ */ new WeakMap<object, object>();
	const pending = /* @__PURE__ */ new WeakMap<ScopedCustomElementRegistry, Map<string, Set<WeakRef<Element>>>>();
	const customNames = /* @__PURE__ */ new WeakMap<Element, string>();
	const tracked = /* @__PURE__ */ new WeakSet<Element>();
	const failed = /* @__PURE__ */ new WeakSet<Element>();
	const upgraded = /* @__PURE__ */ new WeakSet<Element>();
	const inert = document2.implementation.createHTMLDocument("");
	const doc = win.document;
	const NativeHTMLElement = win.HTMLElement;
	const NativeRegistry = win.CustomElementRegistry;
	const nativeGlobal = win.customElements;
	const nativeCreateElement = doc.createElement.bind(doc);
	const nativeAppendChild = win.Node.prototype.appendChild;
	const installationParent = doc.head || doc.documentElement;

	if (!installationParent) {
		throw new TypeError("CustomElementRegistry requires an HTML document");
	}

	const preflightFrame = nativeCreateElement("iframe");

	preflightFrame.hidden = true;
	nativeAppendChild.call(installationParent, preflightFrame);

	try {
		if (!preflightFrame.contentWindow?.document?.documentElement || !preflightFrame.contentWindow.customElements) {
			throw new TypeError("CustomElementRegistry requires same-origin iframe access");
		}
	} finally {
		native.remove.call(installationParent, preflightFrame);
	}
	const customElementsDescriptor = Object.getOwnPropertyDescriptor(win, "customElements");
	const NativeElements = /* @__PURE__ */ new Map<string, HTMLElementConstructor>();
	for (const name of Object.getOwnPropertyNames(win)) {
		if (name !== "HTMLElement" && !/^HTML.*Element$/.test(name)) {
			continue;
		}
		const constructor = Object.getOwnPropertyDescriptor(win, name)?.value;
		const prototype = constructor?.prototype;
		if (
			typeof constructor === "function" &&
			(constructor === NativeHTMLElement ||
				Object.prototype.isPrototypeOf.call(NativeHTMLElement.prototype, prototype))
		) {
			NativeElements.set(name, constructor as HTMLElementConstructor);
		}
	}
	const states = /* @__PURE__ */ new WeakMap<ScopedCustomElementRegistry, RegistryState>();
	const constructors = /* @__PURE__ */ new WeakMap<
		CustomElementConstructor,
		Map<CustomElementRegistry, CustomElementConstructor>
	>();
	const constructorNames = /* @__PURE__ */ new WeakMap<
		CustomElementConstructor,
		Map<ScopedCustomElementRegistry, string>
	>();
	const internalMoves = /* @__PURE__ */ new WeakSet<Node>();
	let activeRegistry: RegistryAssociation | undefined;
	let globalRegistry: ScopedCustomElementRegistry;
	function requireState(registry: ScopedCustomElementRegistry): RegistryState {
		const state = states.get(registry);
		if (!state) {
			throw new TypeError("Illegal invocation");
		}
		return state;
	}
	function currentRegistry(): RegistryAssociation | undefined {
		return activeRegistry;
	}
	function toDOMString(value: unknown): string {
		return `${value}`;
	}
	function withRegistry<T>(registry: RegistryAssociation | undefined, callback: () => T): T {
		const previous = activeRegistry;
		activeRegistry = registry;
		try {
			return callback();
		} finally {
			activeRegistry = previous;
		}
	}
	const lifecycleCallbacks = [
		"connectedCallback",
		"disconnectedCallback",
		"adoptedCallback",
		"formAssociatedCallback",
		"formDisabledCallback",
		"formResetCallback",
		"formStateRestoreCallback",
	] as const;
	function createNativeConstructor(
		registry: ScopedCustomElementRegistry,
		state: RegistryState,
		constructor: CustomElementConstructor,
	): CustomElementConstructor {
		const userPrototype = constructor.prototype;
		if (userPrototype === null) {
			throw new TypeError("Custom element constructor prototype is not an object");
		}
		const callbackPrototype = Object.create(userPrototype);
		let NativeConstructor: CustomElementConstructor;
		const target = function (this: Element) {
			if (state.defining === NativeConstructor) {
				state.defining = false;
			}

			return withRegistry(registry, () => Reflect.construct(constructor, [], constructor));
		};

		NativeConstructor = new Proxy(target as unknown as CustomElementConstructor, {
			get(target, name) {
				return name === "prototype" ? target.prototype : Reflect.get(constructor, name, constructor);
			},
		});
		Object.setPrototypeOf(NativeConstructor, constructor);
		NativeConstructor.prototype = new Proxy(callbackPrototype, {
			get(target, name) {
				const callback = Reflect.get(target, name, userPrototype);
				if (
					typeof name !== "string" ||
					!lifecycleCallbacks.includes(name as (typeof lifecycleCallbacks)[number]) ||
					callback === void 0 ||
					typeof callback !== "function"
				) {
					return callback;
				}
				return function (this: Node, ...args: unknown[]) {
					if (!internalMoves.has(this)) {
						return Reflect.apply(callback, this, args);
					}
				};
			},
		});
		let byRegistry = constructors.get(constructor);
		if (!byRegistry) {
			constructors.set(constructor, (byRegistry = /* @__PURE__ */ new Map()));
		}
		byRegistry.set(registry, NativeConstructor);
		return NativeConstructor;
	}
	function forgetNativeConstructor(
		registry: ScopedCustomElementRegistry,
		constructor: CustomElementConstructor,
	): void {
		const byRegistry = constructors.get(constructor);
		byRegistry?.delete(registry);
		if (!byRegistry?.size) {
			constructors.delete(constructor);
		}
	}
	function duplicateName(name: string): DOMException {
		return new win.DOMException(
			`Failed to execute 'define' on 'CustomElementRegistry': the name "${name}" has already been used with this registry`,
			"NotSupportedError",
		);
	}
	function duplicateConstructor(): DOMException {
		return new win.DOMException(
			"Failed to execute 'define' on 'CustomElementRegistry': this constructor has already been used with this registry",
			"NotSupportedError",
		);
	}
	function assertConstructor(value: CustomElementConstructor): void {
		Reflect.construct(class {}, [], value);
	}
	class Registry implements ScopedCustomElementRegistry {
		constructor() {
			const frame = nativeCreateElement("iframe");
			frame.hidden = true;
			frame.tabIndex = -1;
			nativeAppendChild.call(doc.head || doc.documentElement, frame);
			const realm = frame.contentWindow as RegistryWindow | null;

			if (!realm) {
				throw new TypeError("Unable to create a custom-element registry realm");
			}

			const scopedDocument = realm.document;
			const native2 = realm.customElements as NativeCustomElementRegistry;
			const state: RegistryState = {
				realm,
				document: scopedDocument,
				native: native2,
				defining: false,
			};
			states.set(this, state);
			registerRealm(this, state);
		}
		static [Symbol.hasInstance](value: unknown): boolean {
			return (
				value === nativeGlobal || (typeof value === "object" && value !== null && states.has(value as Registry))
			);
		}
		define(name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions): void {
			const state = requireState(this);
			name = toDOMString(name);
			if (this === globalRegistry) {
				if (nativeGlobal.get(name)) {
					throw duplicateName(name);
				}
				if ((nativeGlobal as NativeCustomElementRegistry).getName?.(constructor)) {
					throw duplicateConstructor();
				}
			}
			if (state.native.get(name)) {
				throw duplicateName(name);
			}
			if (constructors.get(constructor)?.has(this)) {
				throw duplicateConstructor();
			}
			if (state.defining) {
				throw new win.DOMException("A custom element definition is already running", "NotSupportedError");
			}
			state.defining = true;
			let nativeConstructor: CustomElementConstructor | undefined;
			try {
				assertConstructor(constructor);
				if (this !== globalRegistry && options?.extends !== void 0) {
					throw new win.DOMException(
						"Scoped custom element registries do not support customized built-in elements",
						"NotSupportedError",
					);
				}
				const surrogate = createNativeConstructor(this, state, constructor);
				nativeConstructor = surrogate;
				state.defining = surrogate;
				withRegistry(this, () => state.native.define(name, surrogate, options));
			} catch (error) {
				if (nativeConstructor && state.native.get(name) !== nativeConstructor) {
					forgetNativeConstructor(this, constructor);
				}
				throw error;
			} finally {
				state.defining = false;
			}
			let names = constructorNames.get(constructor);

			if (!names) {
				constructorNames.set(constructor, (names = new Map()));
			}

			names.set(this, name);
			definitionAdded(this, name);
		}
		get(name: string): CustomElementConstructor | undefined {
			const state = requireState(this);
			name = toDOMString(name);
			const nativeConstructor = state.native.get(name);
			return nativeConstructor
				? Object.getPrototypeOf(nativeConstructor)
				: this === globalRegistry
					? nativeGlobal.get(name)
					: void 0;
		}
		getName(constructor: CustomElementConstructor): string | null {
			const state = requireState(this);
			const nativeConstructor = constructors.get(constructor)?.get(this);
			const localName = constructorNames.get(constructor)?.get(this);

			return (
				localName ??
				(nativeConstructor ? state.native.getName?.(nativeConstructor) : null) ??
				(this === globalRegistry
					? (nativeGlobal as NativeCustomElementRegistry).getName?.(constructor)
					: null) ??
				null
			);
		}
		async whenDefined(name: string): Promise<CustomElementConstructor> {
			const state = requireState(this);
			name = toDOMString(name);
			const existing = this.get(name);
			if (existing) {
				return existing;
			}
			const defined = state.native
				.whenDefined(name)
				.then((constructor) => Object.getPrototypeOf(constructor) as CustomElementConstructor);
			return this === globalRegistry ? Promise.race([defined, nativeGlobal.whenDefined(name)]) : defined;
		}
		upgrade(root: Node): void {
			requireState(this);
			upgradeRoot(this, root, false);
		}
		initialize(root: Node): void {
			requireState(this);
			upgradeRoot(this, root, true);
		}
	}
	function constructElement(
		constructor: CustomElementConstructor,
		baseName: string,
		NativeBase: HTMLElementConstructor,
	): HTMLElement {
		const registries = constructors.get(constructor);
		const active = currentRegistry();
		const hasContext = activeRegistry !== void 0;
		let registry: CustomElementRegistry | undefined;
		if (hasContext && active && registries?.has(active)) {
			registry = active;
		} else if (!hasContext && globalRegistry && registries?.has(globalRegistry)) {
			registry = globalRegistry;
		} else if (!hasContext && registries?.has(nativeGlobal)) {
			registry = nativeGlobal;
		} else if (registries?.size) {
			throw new TypeError("Illegal constructor (scoped custom elements require a registry context)");
		}
		const RealmBase =
			registry && registry !== nativeGlobal
				? ((requireState(registry as ScopedCustomElementRegistry).realm as unknown as Record<string, unknown>)[
						baseName
					] as HTMLElementConstructor)
				: NativeBase;
		const NativeConstructor = (registry ? constructors.get(constructor)?.get(registry) : undefined) || constructor;
		const instance = Reflect.construct(RealmBase, [], NativeConstructor) as HTMLElement;
		if (NativeConstructor !== constructor) {
			Object.setPrototypeOf(instance, constructor.prototype);
		}
		return finishConstruction(instance, registry || nativeGlobal, !hasContext);
	}
	const ElementBridges = /* @__PURE__ */ new Map<HTMLElementConstructor, HTMLElementConstructor>();
	for (const [name, NativeBase] of NativeElements) {
		const Bridge = function (this: HTMLElement) {
			return constructElement(new.target as unknown as CustomElementConstructor, name, NativeBase);
		} as unknown as HTMLElementConstructor;
		Object.defineProperty(Bridge, "name", { configurable: true, value: name });
		Bridge.prototype = NativeBase.prototype;
		ElementBridges.set(NativeBase, Bridge);
	}
	for (const [name, NativeBase] of NativeElements) {
		const Bridge = ElementBridges.get(NativeBase)!;
		const NativeParent = Object.getPrototypeOf(NativeBase) as HTMLElementConstructor;
		for (const key of Reflect.ownKeys(NativeBase)) {
			if (key === "name" || key === "length" || key === "prototype" || Object.hasOwn(Bridge, key)) {
				continue;
			}
			const property = Object.getOwnPropertyDescriptor(NativeBase, key);

			if (property) {
				Object.defineProperty(Bridge, key, property);
			}
		}
		Object.setPrototypeOf(Bridge, ElementBridges.get(NativeParent) || NativeParent);
		const constructorDescriptor = Object.getOwnPropertyDescriptor(NativeBase.prototype, "constructor");
		if (constructorDescriptor?.configurable) {
			Object.defineProperty(NativeBase.prototype, "constructor", {
				...constructorDescriptor,
				value: Bridge,
			});
		}
		(win as unknown as Record<string, unknown>)[name] = Bridge;
	}
	Object.setPrototypeOf(Registry.prototype, NativeRegistry.prototype);
	win.CustomElementRegistry = Registry as unknown as CustomElementRegistryConstructor;
	globalRegistry = new Registry();
	Object.defineProperty(win, "customElements", {
		configurable: customElementsDescriptor?.configurable ?? true,
		enumerable: customElementsDescriptor?.enumerable ?? true,
		writable: true,
		value: globalRegistry,
	});
	associations.set(document2, globalRegistry);
	associations.set(inert, null);
	let internal = 0;
	let restoreUpgradeBoundaries: (() => void) | undefined;
	const validRegistry = (registry: unknown): RegistryAssociation => {
		if (
			registry !== null &&
			registry !== globalRegistry &&
			(typeof registry !== "object" || !states.has(registry as ScopedCustomElementRegistry))
		) {
			throw new TypeError("Expected a CustomElementRegistry or null");
		}
		return registry as RegistryAssociation;
	};
	const registryFor = (node: Node): RegistryAssociation => {
		if (associations.has(node)) {
			return associations.get(node)!;
		}
		if (node.nodeType === 9) {
			return currentRegistry() || globalRegistry;
		}
		const root = node.getRootNode();
		if (root !== node && associations.has(root)) {
			return associations.get(root)!;
		}
		return currentRegistry() !== void 0
			? currentRegistry()!
			: node.ownerDocument && associations.has(node.ownerDocument)
				? associations.get(node.ownerDocument)!
				: globalRegistry;
	};
	const stateFor = (registry: RegistryAssociation): RegistryState | undefined =>
		registry === null ? undefined : states.get(registry);
	const customName = (node: Element): string => customNames.get(node) || node.getAttribute("is") || node.localName;
	const track = (node: Node, registry: RegistryAssociation): void => {
		if (!registry || node.nodeType !== 1) {
			return;
		}

		const element = node as Element;

		if (upgraded.has(element) || tracked.has(element)) {
			return;
		}
		const name = customName(element);
		if (!name.includes("-")) {
			return;
		}
		tracked.add(element);
		let names = pending.get(registry);
		if (!names) {
			pending.set(registry, (names = /* @__PURE__ */ new Map()));
		}
		let elements = names.get(name);
		if (!elements) {
			names.set(name, (elements = /* @__PURE__ */ new Set()));
		}
		elements.add(new WeakRef(element));
	};
	const normalize = (node: Node): void => {
		const replacement = prototypeMap.get(Object.getPrototypeOf(node));
		if (replacement) {
			Object.setPrototypeOf(node, replacement);
		}
	};
	const walk = <T extends Node>(
		root: T,
		fallback: RegistryAssociation,
		visit: (node: Node, registry: RegistryAssociation) => void,
		initialize = false,
	): T => {
		const stack: Array<[Node, RegistryAssociation]> = [[root, fallback]];
		while (stack.length) {
			const [node, inherited] = stack.pop()!;
			if (!associations.has(node) || (initialize && associations.get(node) === null)) {
				associations.set(node, inherited);
			}
			const registry = associations.get(node)!;
			visit(node, registry);
			const children = [...node.childNodes];
			for (let i = children.length - 1; i >= 0; --i) {
				stack.push([children[i]!, registry]);
			}
			const element = node.nodeType === 1 ? (node as Element) : undefined;
			const shadow = element && (shadows.get(element) || element.shadowRoot);
			if (shadow) {
				stack.push([shadow, registry]);
			}
			if (element instanceof win.HTMLTemplateElement) {
				stack.push([element.content, null]);
			}
			if (element) {
				for (const attribute of element.attributes) {
					normalize(attribute);
				}
			}
		}
		return root;
	};
	const prepare = <T extends Node>(root: T, registry = registryFor(root), initialize = false): T =>
		walk<T>(
			root,
			registry,
			(node, assigned) => {
				normalize(node);
				track(node, assigned);
			},
			initialize,
		);
	const rehome = <T extends Node>(node: T, target: Document): T => {
		if (node.ownerDocument !== target && node.nodeType !== 9) {
			const muted: Node[] = [];
			walk(node, registryFor(node), (child) => {
				if (!internalMoves.has(child)) {
					internalMoves.add(child);
					muted.push(child);
				}
			});
			try {
				native.adopt.call(target, node);
			} finally {
				for (const child of muted) {
					internalMoves.delete(child);
				}
			}
		}
		return node;
	};
	const upgradeElement = (node: Node, registry: RegistryAssociation): void => {
		const state = stateFor(registry);
		if (!state || !registry || node.nodeType !== 1) {
			return;
		}

		const element = node as Element;

		if (
			failed.has(element) ||
			upgraded.has(element) ||
			(element.localName.includes("-") && native.matches.call(element, ":defined"))
		) {
			return;
		}
		const constructor = registry.get(customName(element));
		if (!constructor) {
			return;
		}
		const owner = node.ownerDocument;
		const parent = node.parentNode;
		const next = node.nextSibling;
		const existing: Node[] = [];
		walk(node, registry, (child) => {
			const childElement = child.nodeType === 1 ? (child as Element) : undefined;
			if (
				childElement &&
				(upgraded.has(childElement) ||
					(childElement.localName.includes("-") && native.matches.call(childElement, ":defined"))) &&
				!internalMoves.has(child)
			) {
				internalMoves.add(child);
				existing.push(child);
			}
		});
		const boundaries: Array<[Node, Node, Node | null]> = [];
		const inspection: Node[] = [node];
		while (inspection.length) {
			const parent2 = inspection.pop()!;
			for (const child of parent2.childNodes) {
				if (registryFor(child) !== registry) {
					boundaries.push([child, parent2, child.nextSibling]);
				} else {
					inspection.push(child);
				}
			}
			const parentElement = parent2.nodeType === 1 ? (parent2 as Element) : undefined;
			const shadow = parentElement && (shadows.get(parentElement) || parentElement.shadowRoot);
			if (shadow) {
				inspection.push(shadow);
			}
		}
		const previousRestore = restoreUpgradeBoundaries;
		const restore = () => {
			restoreUpgradeBoundaries = previousRestore;
			for (const [child, parent2, next2] of boundaries.reverse()) {
				rehome(child, parent2.ownerDocument || document2);
				native.insert.call(parent2, child, next2);
			}
			boundaries.length = 0;
		};
		++internal;
		try {
			for (const [child, parent2] of boundaries) {
				native.remove.call(parent2, child);
			}
			restoreUpgradeBoundaries = restore;
			rehome(node, state.document);
			withRegistry(registry, () => state.native.upgrade(node));
			prepare(node, registry);
			if (!(element instanceof constructor)) {
				failed.add(element);
			}
		} finally {
			restore();
			rehome(node, owner || document2);
			if (parent) {
				native.insert.call(parent, node, next);
			}
			for (const child of existing) {
				internalMoves.delete(child);
			}
			--internal;
		}
	};
	const upgradeTree = <T extends Node>(root: T, registry = registryFor(root), initialize = false): T => {
		prepare(root, registry, initialize);
		walk(root, registry, (node, assigned) => {
			if (assigned === registry || initialize) {
				upgradeElement(node, assigned);
			}
		});
		return root;
	};
	function registerRealm(registry: ScopedCustomElementRegistry, state: RegistryState): void {
		associations.set(state.document, registry);
		for (const name of Object.getOwnPropertyNames(win)) {
			const source = descriptor(state.realm, name)?.value?.prototype;
			const target = descriptor(win, name)?.value?.prototype;
			if (
				source &&
				target &&
				(source === state.realm.Node.prototype ||
					Object.prototype.isPrototypeOf.call(state.realm.Node.prototype, source))
			) {
				prototypeMap.set(source, target);
			}
		}
	}
	function finishConstruction<T extends HTMLElement>(node: T, registry: CustomElementRegistry, direct: boolean): T {
		associations.set(node, registry);
		upgraded.add(node);
		restoreUpgradeBoundaries?.();
		if (direct) {
			rehome(node, document2);
		}
		return node;
	}
	function definitionAdded(registry: ScopedCustomElementRegistry, name: string): void {
		if (registry === globalRegistry) {
			prepare(document2, globalRegistry);
		}
		const elements = pending.get(registry)?.get(name);
		if (elements) {
			pending.get(registry)!.delete(name);
			for (const ref of elements) {
				const node = ref.deref();
				if (node?.isConnected && registryFor(node) === registry) {
					upgradeElement(node, registry);
				}
			}
		}
	}
	function upgradeRoot(registry: ScopedCustomElementRegistry, root: Node, initialize: boolean): void {
		if (!(root instanceof Node) && !(root as { nodeType?: unknown }).nodeType) {
			throw new TypeError("Expected a Node");
		}
		prepare(root);
		upgradeTree(root, registry, initialize);
	}
	const sourceDocument = (registry: RegistryAssociation, destination = document2): Document =>
		registry === null
			? inert
			: registry === globalRegistry
				? destination
				: stateFor(registry)?.document || destination;
	const create = (
		target: Document,
		namespace: string | null | undefined,
		name: string,
		options: ElementCreationOptionsWithRegistry | undefined,
		registry: RegistryAssociation,
	): Element => {
		validRegistry(registry);
		const source =
			namespace === void 0 && target.contentType !== "text/html" ? target : sourceDocument(registry, target);
		const nativeOptions = options && { ...options };

		if (nativeOptions) {
			delete nativeOptions.customElementRegistry;
		}

		const node = withRegistry(registry, () =>
			namespace === void 0
				? native.create.call(source, name, nativeOptions)
				: (
						native.createNS as unknown as (
							this: Document,
							namespace: string | null,
							name: string,
							options?: ElementCreationOptions,
						) => Element
					).call(source, namespace, name, nativeOptions),
		);
		if (options?.is) {
			customNames.set(node, String(options.is));
		}
		prepare(node, registry);
		rehome(node, target);
		upgradeTree(node, registry);
		return node;
	};
	const selected = (target: Node, options?: ElementCreationOptionsWithRegistry): RegistryAssociation =>
		options && "customElementRegistry" in options
			? validRegistry(options.customElementRegistry)
			: registryFor(target);
	Document.prototype.createElement = function (
		this: Document,
		name: string,
		options?: ElementCreationOptionsWithRegistry,
	): HTMLElement {
		return create(this, void 0, name, options, selected(this, options)) as HTMLElement;
	} as typeof Document.prototype.createElement;
	(Document.prototype.createElementNS as unknown) = function (
		this: Document,
		namespace: string | null,
		name: string,
		options?: ElementCreationOptionsWithRegistry,
	): Element {
		return create(this, namespace, name, options, selected(this, options));
	};
	Element.prototype.attachShadow = function (options: ShadowRootInitWithRegistry): ShadowRoot {
		let registry = registryFor(this);
		for (const key of ["customElements", "registry", "customElementRegistry"] as const) {
			if (key in options) {
				registry = validRegistry(options[key]);
			}
		}
		const nativeOptions = { ...options } as ShadowRootInitWithRegistry;

		delete nativeOptions.customElements;
		delete nativeOptions.registry;
		delete nativeOptions.customElementRegistry;

		if (registry === null) {
			nativeOptions.customElementRegistry = null;
		}

		const root = native.attach.call(this, nativeOptions);
		associations.set(root, registry);
		if (registry === null) {
			nullShadows.add(root);
		}
		shadows.set(this, root);
		normalize(root);
		return root;
	};
	for (const prototype of [Element.prototype, Document.prototype, ShadowRoot.prototype]) {
		Object.defineProperty(prototype, "customElementRegistry", {
			configurable: true,
			enumerable: true,
			get(this: Node) {
				return registryFor(this);
			},
		});
	}
	for (const key of ["registry", "customElements"]) {
		Object.defineProperty(ShadowRoot.prototype, key, {
			configurable: true,
			get(this: ShadowRoot) {
				return registryFor(this);
			},
		});
	}
	const parse = (
		context: Element | ShadowRoot,
		html: string,
		registry: RegistryAssociation,
		contextual = false,
	): DocumentFragment => {
		const source = sourceDocument(registry, context.ownerDocument);
		const contextElement = context instanceof Element ? context : context.host;
		let name = contextElement.localName;
		const namespace = contextElement.namespaceURI || "http://www.w3.org/1999/xhtml";
		if (name.includes("-")) {
			name = "div";
		}
		const container = native.createNS.call(source, namespace, name);
		return withRegistry(registry, () => {
			let fragment: DocumentFragment;
			const range = source.createRange();
			range.selectNodeContents(container);
			if (contextual) {
				fragment = native.rangeFragment.call(range, html);
			} else {
				native.html.set!.call(container, html);
				if (container instanceof win.HTMLTemplateElement) {
					fragment = container.content;
				} else {
					range.selectNodeContents(container);
					fragment = range.extractContents();
				}
			}
			upgradeTree(fragment, container instanceof win.HTMLTemplateElement ? null : registry);
			rehome(fragment, context.ownerDocument || document2);
			return fragment;
		});
	};
	const setHTML = function (this: Element | ShadowRoot, html: string): void {
		const registry = registryFor(this);
		const fragment = parse(this, html, registry);
		const destination = this instanceof win.HTMLTemplateElement ? this.content : this;

		if (this instanceof win.HTMLTemplateElement) {
			associations.set(destination, null);
		}

		(destination.nodeType === 11 ? native.fragmentReplaceChildren : native.replaceChildren).call(
			destination,
			fragment,
		);
	};
	Object.defineProperty(Element.prototype, "innerHTML", { ...native.html, set: setHTML });
	Object.defineProperty(ShadowRoot.prototype, "innerHTML", { ...native.shadowHTML, set: setHTML });
	Element.prototype.insertAdjacentHTML = function (position: InsertPosition, html: string): void {
		position = String(position).toLowerCase() as InsertPosition;
		if (!["beforebegin", "afterbegin", "beforeend", "afterend"].includes(position)) {
			throw new win.DOMException("Invalid position", "SyntaxError");
		}
		const outside = position === "beforebegin" || position === "afterend";
		const parent = outside ? this.parentNode : this;
		if (!parent || parent.nodeType === 9) {
			throw new win.DOMException("No insertion parent", "NoModificationAllowedError");
		}
		const context = parent instanceof ShadowRoot ? parent : (parent as Element);
		const fragment = parse(context, html, registryFor(parent));
		const before =
			position === "beforebegin"
				? this
				: position === "afterbegin"
					? this.firstChild
					: position === "afterend"
						? this.nextSibling
						: null;
		native.insert.call(parent, fragment, before);
	};
	Object.defineProperty(Element.prototype, "outerHTML", {
		...native.outerHTML,
		set(this: Element, html: string) {
			const parent = this.parentNode;
			if (!parent || parent.nodeType === 9) {
				return native.outerHTML.set!.call(this, html);
			}
			const context = parent instanceof ShadowRoot ? parent : (parent as Element);
			const fragment = parse(context, html, registryFor(parent));
			native.replace.call(parent, fragment, this);
		},
	});
	Range.prototype.createContextualFragment = function (html: string): DocumentFragment {
		let context = this.startContainer;
		if (context.nodeType !== 1) {
			context = context.parentElement || document2.body;
		}
		return parse(context as Element, html, registryFor(context), true);
	};
	const copy = <T extends Node>(
		node: T,
		destination: Document,
		deep: boolean,
		override: RegistryAssociation | undefined,
		fallbackOnly = false,
	): T => {
		const cloneOne = (original: Node, forced: RegistryAssociation | undefined): Node => {
			const originalRegistry = registryFor(original);
			const registry =
				forced === void 0 || (fallbackOnly && originalRegistry !== null) ? originalRegistry : forced;
			const clone = withRegistry(registry, () =>
				native.import.call(sourceDocument(registry, destination), original, false),
			);
			if (original.nodeType === 1 && clone.nodeType === 1 && customNames.has(original as Element)) {
				customNames.set(clone as Element, customNames.get(original as Element)!);
			}
			upgradeTree(clone, registry);
			rehome(clone, destination);
			return clone;
		};
		const root = cloneOne(node, override) as T;
		const stack: Array<[Node, Node, RegistryAssociation | undefined]> = deep ? [[node, root, override]] : [];
		while (stack.length) {
			const [original, clone, forced] = stack.pop()!;
			if (original instanceof win.HTMLTemplateElement) {
				stack.push([original.content, (clone as HTMLTemplateElement).content, null]);
			}
			for (const child of original.childNodes) {
				const childClone = cloneOne(child, forced);
				native.append.call(clone, childClone);
				stack.push([child, childClone, forced]);
			}
		}
		return root;
	};
	Node.prototype.cloneNode = function (deep = false): Node {
		return this.nodeType === 9
			? native.clone.call(this, Boolean(deep))
			: copy(this, this.ownerDocument || document2, Boolean(deep), void 0);
	};
	Document.prototype.importNode = function <T extends Node>(
		this: Document,
		node: T,
		options: boolean | ImportNodeOptionsWithRegistry = false,
	): T {
		const modern = options !== null && typeof options === "object";
		const modernOptions = modern ? options : undefined;

		return copy(
			node,
			this,
			modernOptions ? !modernOptions.selfOnly : Boolean(options),
			selected(this, modernOptions),
			true,
		);
	} as typeof Document.prototype.importNode;
	const adoptAssociations = (root: Node, target: Document): void => {
		if (root.ownerDocument === target) {
			return;
		}
		const targetRegistry = registryFor(target);
		const effectiveGlobal = (registry: RegistryAssociation): RegistryAssociation =>
			registry === globalRegistry ? registry : null;
		const stack: Node[] = [root];
		while (stack.length) {
			const node = stack.pop()!;
			const registry = registryFor(node);
			if (node.nodeType === 1 && (registry === null || registry === globalRegistry)) {
				const parent = node === root ? null : node.parentNode;
				const parentHasHost = parent && "host" in parent;
				const inherited =
					registry !== null || !parent || (parent.nodeType === 11 && !parentHasHost)
						? targetRegistry
						: registryFor(parent);
				associations.set(node, effectiveGlobal(inherited));
				tracked.delete(node as Element);
				track(node, registryFor(node));
			} else if (
				node instanceof ShadowRoot &&
				node.host &&
				(registry === globalRegistry || (registry === null && !nullShadows.has(node)))
			) {
				associations.set(node, effectiveGlobal(targetRegistry));
			}
			const element = node.nodeType === 1 ? (node as Element) : undefined;
			const shadow = element && (shadows.get(element) || element.shadowRoot);
			if (shadow) {
				stack.push(shadow);
			}
			for (let i = node.childNodes.length - 1; i >= 0; --i) {
				stack.push(node.childNodes[i]!);
			}
		}
	};
	Document.prototype.adoptNode = function <T extends Node>(this: Document, node: T): T {
		prepare(node);
		adoptAssociations(node, this);
		return native.adopt.call(this, node) as T;
	} as typeof Document.prototype.adoptNode;
	const shadowPrototype = ShadowRoot.prototype as ShadowRootExtensions;

	shadowPrototype.createElement = function (name: string, options?: ElementCreationOptionsWithRegistry): HTMLElement {
		return create(this.ownerDocument, void 0, name, options, registryFor(this)) as HTMLElement;
	};
	shadowPrototype.createElementNS = function (
		namespace: string | null,
		name: string,
		options?: ElementCreationOptionsWithRegistry,
	): Element {
		return create(this.ownerDocument, namespace, name, options, registryFor(this));
	};
	shadowPrototype.importNode = function <T extends Node>(node: T, deep = false): T {
		return copy(node, this.ownerDocument, Boolean(deep), registryFor(this));
	};
	type InsertionMethod = (this: Node, ...nodes: Array<Node | string | null>) => unknown;
	const isNode = (node: unknown): node is Node =>
		node instanceof Node ||
		(typeof node === "object" && node !== null && Boolean((node as { nodeType?: unknown }).nodeType));
	function patchInsertion(prototypes: object[], methods: string[], sibling = false, single = false): void {
		for (const prototype of prototypes) {
			for (const key of methods) {
				const methods = prototype as Record<string, InsertionMethod>;
				const method = methods[key]!;
				methods[key] = function (this: Node, ...nodes: Array<Node | string | null>): unknown {
					const parent = sibling ? this.parentNode : this;
					if (parent && !internal) {
						const reference = nodes[1];
						if (
							(key === "insertBefore" &&
								(nodes.length < 2 ||
									(reference != null && (!isNode(reference) || reference.parentNode !== parent)))) ||
							(key === "replaceChild" &&
								(nodes.length < 2 || !isNode(reference) || reference.parentNode !== parent))
						) {
							return method.apply(this, nodes);
						}
						const insertionCount = single ? Math.min(1, nodes.length) : nodes.length;
						for (let i = 0; i < insertionCount; ++i) {
							const node = nodes[i];
							if (isNode(node) && (node === parent || node.contains(parent))) {
								return method.apply(this, nodes);
							}
						}
						for (let i = 0; i < insertionCount; ++i) {
							const node = nodes[i];
							if (isNode(node)) {
								const insertedNode = node as Node;
								const targetDocument = parent.ownerDocument || (parent as Document);

								adoptAssociations(insertedNode, targetDocument);
								upgradeTree(insertedNode, registryFor(parent));
							}
						}
					}
					return method.apply(this, nodes);
				};
				if (single) {
					Object.defineProperty(methods[key], "length", { value: method.length });
				}
			}
		}
	}
	patchInsertion([Node.prototype], ["appendChild", "insertBefore", "replaceChild"], false, true);
	patchInsertion(
		[Element.prototype, Document.prototype, DocumentFragment.prototype],
		["append", "prepend", "replaceChildren"],
	);
	patchInsertion(
		[Element.prototype, win.CharacterData.prototype, win.DocumentType.prototype],
		["before", "after", "replaceWith"],
		true,
	);
	const observer = new win.MutationObserver((records) => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (node.isConnected) {
					upgradeTree(node, registryFor(record.target));
				}
			}
		}
	});
	observer.observe(document2, { childList: true, subtree: true });
	const api: InternalInstallation = {
		CustomElementRegistry: Registry as unknown as CustomElementRegistryConstructor,
		customElements: globalRegistry as unknown as ScopedCustomElementRegistry,
		states: states as WeakMap<ScopedCustomElementRegistry, RegistryState>,
	};
	Object.defineProperty(win, installed, { value: api });
	return api;
}
