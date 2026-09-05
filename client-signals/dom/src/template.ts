import { PersistentFragment } from "@serve-tools/client-dom-fragment";
import { Signal } from "@serve-tools/signal";
import { captureBinding, captureBindingResource, isCapturingBindings } from "./scope.js";

export { PersistentFragment };

/** An inert HTML template description. */
export interface TemplateResult {
	readonly strings: TemplateStringsArray;
	readonly values: readonly unknown[];
}

/** A one-shot DOM template with explicitly disposable bindings and resources. */
export interface TemplateFragment extends DocumentFragment {
	dispose(): void;
}

/** Configures an element and optionally returns synchronous cleanup. */
export type TemplateDirective = (element: Element) => void | (() => void);

type Cleanup = () => void;
type Watcher = InstanceType<typeof Signal.subtle.Watcher> & { reference?: WeakRef<Watcher> };
type Computed = InstanceType<typeof Signal.Computed>;
type Mode = "inline" | "owned" | "scoped";
type Bind = (owner: object, run: Cleanup, own: (cleanup: Cleanup) => void) => void;
type ListenerValue = (EventListener | EventListenerObject) & AddEventListenerOptions;
type ChildValue = Node | PersistentFragment | TemplateResult | string;

interface Listener extends EventListenerObject {
	owner: object | undefined;
	value: ListenerValue | undefined;
	capture: boolean | undefined;
	once: boolean | undefined;
	passive: boolean | undefined;
	signal: AbortSignal | undefined;
}

interface Prepared {
	content: DocumentFragment;
	prefix: string;
}

interface Fragment extends TemplateFragment {
	refresh?(): void;
}

interface Rendered {
	fragment: Fragment;
	region: PersistentFragment;
	result: TemplateResult;
}

const owners = new WeakMap<object, Watcher>();
const active = new WeakSet<Computed>();
const pending = new Set<WeakRef<Watcher>>();
const prepared = new WeakMap<TemplateStringsArray, WeakMap<Document, Prepared>>();
const results = new WeakSet<object>();

const combined = (errors: unknown[], message: string): unknown =>
	errors.length === 1 ? errors[0] : new AggregateError(errors, message);

const flush = (): void => {
	const effects: Computed[] = [];
	let errors: unknown[] | undefined;

	for (const reference of pending) {
		const watcher = reference.deref();
		if (!watcher) {
			continue;
		}
		effects.push(...watcher.getPending());
		watcher.watch();
	}
	pending.clear();

	for (const effect of effects) {
		if (!active.has(effect)) {
			continue;
		}
		try {
			effect.get();
		} catch (error) {
			(errors ??= []).push(error);
		}
	}
	if (errors) {
		throw combined(errors, "Multiple effects failed");
	}
};

function notify(this: Watcher): void {
	if (!pending.size) {
		queueMicrotask(flush);
	}
	pending.add((this.reference ??= new WeakRef(this)));
}

const ownedBind: Bind = (owner, run, own) => {
	let watcher = owners.get(owner);
	if (!watcher) {
		watcher = new Signal.subtle.Watcher(notify);
		owners.set(owner, watcher);
	}
	const effect = new Signal.Computed(run);
	active.add(effect);
	own(() => {
		if (active.delete(effect)) {
			watcher.unwatch(effect);
		}
	});
	if (!active.has(effect)) {
		return;
	}
	watcher.watch(effect);
	effect.get();
};

const scopedBind: Bind = (_owner, run, own) => {
	const binding = captureBinding(undefined, run);
	if (!binding) {
		throw new TypeError("createFragment() must be used inside BindingScope.capture()");
	}
	own(binding.dispose);
	try {
		Signal.subtle.untrack(binding.run);
	} catch (error) {
		binding.dispose();
		throw error;
	}
};

function handleEvent(this: Listener, event: Event): void {
	if (typeof this.value === "function") {
		this.value.call(this.owner, event);
	} else {
		this.value?.handleEvent(event);
	}
}

const isNode = (value: unknown): value is Node => {
	if (!value || typeof value !== "object" || typeof (value as Node).nodeType !== "number") {
		return false;
	}
	try {
		return Node.prototype.isSameNode.call(value, value as Node);
	} catch {
		return false;
	}
};

/** Returns whether a value was created by this module's `html` tag. */
export const isTemplateResult = (value: unknown): value is TemplateResult =>
	value !== null && (typeof value === "object" || typeof value === "function") && results.has(value);

const collect = (value: unknown, items: ChildValue[] = []): ChildValue[] => {
	if (isNode(value) || value instanceof PersistentFragment || isTemplateResult(value)) {
		items.push(value);
	} else if (typeof value !== "string" && value != null && Symbol.iterator in Object(value)) {
		for (const item of value as Iterable<unknown>) {
			collect(item, items);
		}
	} else {
		items.push(String(value ?? ""));
	}
	return items;
};

const insert = (before: Comment, value: Node | PersistentFragment | string): void => {
	if (value instanceof PersistentFragment) {
		value.insertBefore(before.parentNode as Element | DocumentFragment, before);
	} else {
		before.before(value);
	}
};

const removeBetween = (start: Text, end: Comment): void => {
	while (start.nextSibling !== end) {
		const next = start.nextSibling;
		if (!next) {
			throw new DOMException("Template child boundaries were removed", "InvalidStateError");
		}
		const region = PersistentFragment.fromNode(next);
		if (region) {
			region.remove();
		} else {
			next.remove();
		}
	}
};

const disposeRendered = (items: Rendered[], remove = true): void => {
	let errors: unknown[] | undefined;
	for (const item of items.splice(0)) {
		if (remove) {
			try {
				item.region.remove();
			} catch (error) {
				(errors ??= []).push(error);
			}
		}
		try {
			item.fragment.dispose();
		} catch (error) {
			(errors ??= []).push(error);
		}
	}
	if (errors) {
		throw combined(errors, "Nested template cleanup failed");
	}
};

// biome-ignore lint/suspicious/noControlCharactersInRegex: A reserved sentinel marks template holes.
const tokens = /<[a-z](?:[^>"']|"[^"]*"|'[^']*')*>|\x01/gi;
// biome-ignore lint/suspicious/noControlCharactersInRegex: Whole-value bindings consume the sentinel.
const bindings = /([^\s\\>"'=]+)\s*=\s*(['"]?)\x01\2(?=[\s/>])|\x01/g;

const targets = (root: DocumentFragment, ownerDocument: Document, prefix: string) => {
	const found: { node: Element | Comment; part: Attr | Comment; index: number }[] = [];
	const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
	while (walker.nextNode()) {
		const node = walker.currentNode as Element | Comment;
		for (const part of node.nodeType === Node.COMMENT_NODE
			? [node as Comment]
			: [...(node as Element).attributes]) {
			const key = part.nodeType === Node.COMMENT_NODE ? (part as Comment).data : (part as Attr).name;
			if (key.startsWith(prefix)) {
				found.push({ node, part, index: Number(key.slice(prefix.length)) });
			}
		}
	}
	return found;
};

const prepare = (strings: TemplateStringsArray, ownerDocument: Document): Prepared => {
	let documents = prepared.get(strings);
	if (!documents) {
		prepared.set(strings, (documents = new WeakMap()));
	}
	const cached = documents.get(ownerDocument);
	if (cached) {
		return cached;
	}
	if (strings.some((part) => part.includes("\x01"))) {
		throw new SyntaxError("Template source contains a reserved binding marker");
	}

	const source = strings.join("\x01").trim();
	let prefix = "#";
	while (source.includes(prefix)) {
		prefix += "#";
	}
	let index = 0;
	const template = ownerDocument.createElement("template");
	template.innerHTML = source.replace(tokens, (token, offset: number) => {
		if (token === "\x01") {
			const before = source.slice(0, offset);
			if (/^<\/?(?:[a-z][^<>]*)?$/i.test(before.slice(before.lastIndexOf("<")))) {
				throw new SyntaxError("Dynamic tag names and partial tags are unsupported");
			}
			return `<!--${prefix}${index++}-->`;
		}
		return token.replace(bindings, (_: string, name: string | undefined, _quote: string, offset: number) => {
			if (!name && (!/\s/.test(token[offset - 1] ?? "") || !/[\s/>]/.test(token[offset + 1] ?? ""))) {
				throw new SyntaxError("Directives must occupy a complete attribute position");
			}
			return `${prefix}${index++}="${name ?? ""}"`;
		});
	});
	const value = { content: template.content, prefix };
	const holes = targets(template.content, ownerDocument, prefix);
	if (new Set(holes.map(({ index }) => index)).size !== strings.length - 1 || holes.length !== strings.length - 1) {
		throw new SyntaxError("Use child bindings or whole attribute values; this template context is unsupported");
	}
	documents.set(ownerDocument, value);
	return value;
};

const render = (result: TemplateResult, owner: object, ownerDocument: Document, mode: Mode): Fragment => {
	if (!isTemplateResult(result)) {
		throw new TypeError("createFragment() requires a TemplateResult");
	}
	if (owner === null || (typeof owner !== "object" && typeof owner !== "function")) {
		throw new TypeError("A template owner must be an object");
	}
	if (mode === "scoped" && !isCapturingBindings()) {
		throw new TypeError("createFragment() must be used inside BindingScope.capture()");
	}
	if (result.values.length !== result.strings.length - 1) {
		throw new SyntaxError("Template values do not match its binding holes");
	}

	const plan = prepare(result.strings, ownerDocument);
	const fragment = plan.content.cloneNode(true) as Fragment;
	if (!result.values.length) {
		fragment.dispose = () => {};
		return fragment;
	}
	const cleanups: Cleanup[] = [];
	const refreshers: Cleanup[] = [];
	let disposed = false;
	let releaseScope: Cleanup | undefined;
	const dispose = (errors?: unknown[]): void => {
		if (disposed) {
			if (errors) {
				throw combined(errors, "Template cleanup failed");
			}
			return;
		}
		disposed = true;
		try {
			releaseScope?.();
		} catch (error) {
			(errors ??= []).push(error);
		}
		releaseScope = undefined;
		for (const cleanup of cleanups.splice(0)) {
			try {
				cleanup();
			} catch (error) {
				(errors ??= []).push(error);
			}
		}
		refreshers.length = 0;
		if (errors) {
			throw combined(errors, "Template cleanup failed");
		}
	};
	const own = (cleanup: Cleanup): void => {
		if (disposed) {
			cleanup();
		} else {
			cleanups.push(cleanup);
		}
	};
	fragment.dispose = () => dispose();
	if (mode === "inline") {
		fragment.refresh = () => {
			if (!disposed) {
				for (const refresh of refreshers) {
					refresh();
				}
			}
		};
	}
	const bind = mode === "owned" ? ownedBind : scopedBind;

	try {
		if (mode === "scoped") {
			const resource = captureBindingResource(dispose);
			if (!resource) {
				throw new TypeError("createFragment() must be used inside BindingScope.capture()");
			}
			releaseScope = resource.dispose;
		}
		for (const { node, part, index } of targets(fragment, ownerDocument, plan.prefix)) {
			if (disposed) {
				break;
			}
			const value = result.values[index];
			let write: (value: any, nestedMode: Mode) => void;
			let refreshChild: Cleanup | undefined;

			if (part === node) {
				const text = ownerDocument.createTextNode("");
				let end: Comment | undefined;
				let content: Node | PersistentFragment | undefined;
				let rendered: Rendered[] = [];
				node.replaceWith(text);
				own(() => disposeRendered(rendered, false));
				refreshChild = () => {
					for (const { fragment } of rendered) {
						fragment.refresh?.();
					}
				};
				write = (next: unknown, nestedMode: Mode) => {
					if (content && next === content) {
						return;
					}
					const nodeValue = isNode(next) || next instanceof PersistentFragment;
					const iterable =
						!nodeValue &&
						!isTemplateResult(next) &&
						typeof next !== "string" &&
						next != null &&
						Symbol.iterator in Object(next);
					const items = nodeValue
						? undefined
						: iterable || isTemplateResult(next)
							? collect(next)
							: undefined;
					if (!items) {
						if (end) {
							removeBetween(text, end);
						}
						const retired = rendered;
						const nextContent = nodeValue ? (next as Node | PersistentFragment) : undefined;
						if (nextContent) {
							if (!end) {
								text.after((end = ownerDocument.createComment("")));
							}
							text.data = "";
							insert(end, nextContent);
						} else {
							text.data = String(next ?? "");
						}
						rendered = [];
						content = nextContent;
						disposeRendered(retired);
						return;
					}
					if (!rendered.length && !items.some(isTemplateResult)) {
						if (!end) {
							text.after((end = ownerDocument.createComment("")));
						}
						removeBetween(text, end);
						text.data = "";
						for (const item of items as (Node | PersistentFragment | string)[]) {
							insert(end, item);
						}
						content = undefined;
						return;
					}
					const available = new Map<TemplateResult, Rendered[]>();
					for (let index = rendered.length - 1; index >= 0; --index) {
						const entry = rendered[index]!;
						const entries = available.get(entry.result);
						if (entries) {
							entries.push(entry);
						} else {
							available.set(entry.result, [entry]);
						}
					}
					const nextRendered: Rendered[] = [];
					const insertions: (Node | PersistentFragment | string)[] = [];
					const created: Rendered[] = [];
					try {
						for (const item of items) {
							if (!isTemplateResult(item)) {
								insertions.push(item);
								continue;
							}
							const entries = available.get(item);
							let entry = entries?.pop();
							if (entry) {
								entry.fragment.refresh?.();
							} else {
								const child = render(item, owner, ownerDocument, nestedMode);
								entry = {
									fragment: child,
									region: new PersistentFragment(child.childNodes, ownerDocument),
									result: item,
								};
								created.push(entry);
							}
							nextRendered.push(entry);
							insertions.push(entry.region);
						}
					} catch (error) {
						try {
							disposeRendered(created);
						} catch (cleanupError) {
							throw new AggregateError(
								[error, cleanupError],
								"Nested template setup and rollback failed",
							);
						}
						throw error;
					}
					const retired = [...available.values()].flat();
					if (disposed) {
						disposeRendered(created);
						return;
					}
					let committed = false;
					try {
						if (!end) {
							text.after((end = ownerDocument.createComment("")));
						}
						removeBetween(text, end);
						text.data = "";
						for (const item of insertions) {
							insert(end, item);
						}
						content = undefined;
						rendered = nextRendered;
						committed = true;
						disposeRendered(retired);
					} catch (error) {
						if (!committed) {
							try {
								disposeRendered(created);
							} catch (cleanupError) {
								throw new AggregateError(
									[error, cleanupError],
									"Nested template update and rollback failed",
								);
							}
						}
						throw error;
					}
				};
			} else {
				const element = node as Element;
				const attribute = part as Attr;
				const name = attribute.value;
				element.removeAttribute(attribute.name);
				if (!name) {
					const cleanup = (value as TemplateDirective)(element);
					if (typeof cleanup === "function") {
						own(cleanup);
					} else if (cleanup !== undefined) {
						throw new TypeError("Template directives must finish synchronously");
					}
					continue;
				}
				if (name.startsWith("@")) {
					const type = name.slice(1);
					let listener: Listener | undefined;
					write = (next: ListenerValue | null | undefined) => {
						const capture = next?.capture;
						const once = next?.once;
						const passive = next?.passive;
						const signal = next?.signal;
						if (disposed && next != null) {
							return;
						}
						if (
							!listener ||
							next == null ||
							capture !== listener.capture ||
							once !== listener.once ||
							passive !== listener.passive ||
							signal !== listener.signal
						) {
							if (listener) {
								listener.value = listener.owner = undefined;
								element.removeEventListener(type, listener, { capture: listener.capture ?? false });
								listener = undefined;
							}
							if (next != null) {
								const current = { handleEvent, owner, value: next, capture, once, passive, signal };
								element.addEventListener(type, current, {
									...(capture === undefined ? {} : { capture }),
									...(once === undefined ? {} : { once }),
									...(passive === undefined ? {} : { passive }),
									...(signal === undefined ? {} : { signal }),
								});
								listener = current;
							}
						} else {
							listener.value = next;
						}
					};
					own(() => write(null, mode));
				} else if (name.startsWith(".")) {
					const property = name.slice(1);
					write = (next: unknown) => {
						(element as unknown as Record<string, unknown>)[property] = next;
					};
				} else {
					write = (next: unknown) => {
						if (next === null) {
							element.removeAttribute(name);
						} else {
							element.setAttribute(name, String(next));
						}
					};
				}
			}

			const apply = (next: unknown, nestedMode: Mode): void => {
				if (!disposed) {
					write(next, nestedMode);
				}
			};
			if (Signal.isState(value) || Signal.isComputed(value)) {
				const run = () => apply(value.get(), "inline");
				if (mode === "inline") {
					refreshers.push(run);
					run();
				} else {
					bind(owner, run, own);
				}
			} else {
				apply(value, mode);
				if (mode === "inline" && refreshChild) {
					refreshers.push(refreshChild);
				}
			}
		}
	} catch (error) {
		dispose([error]);
	}
	return fragment;
};

const result = (strings: TemplateStringsArray, values: unknown[]): TemplateResult => {
	const value = { strings, values };
	results.add(value);
	return value;
};

const isStrings = (value: unknown): value is TemplateStringsArray =>
	Array.isArray(value) && Object.hasOwn(value, "raw");
const assertOwner = (owner: object): void => {
	if (owner === null || (typeof owner !== "object" && typeof owner !== "function")) {
		throw new TypeError("A template owner must be an object");
	}
};
const ownerDocument = (owner: object, explicit?: Document): Document =>
	explicit ?? (owner as Node).ownerDocument ?? document;
const legacy = (owner: object, explicit: Document | undefined, mode: "owned" | "scoped") => {
	assertOwner(owner);
	const document = ownerDocument(owner, explicit);
	return (strings: TemplateStringsArray, ...values: unknown[]): TemplateFragment =>
		render(result(strings, values), owner, document, mode);
};

/** Returns an inert template descriptor without parsing markup or installing bindings. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult;

/** @deprecated Use owner-free `html` and `createFragment(result, owner, ownerDocument?)`. */
export function html(
	owner: object,
	ownerDocument?: Document,
): (strings: TemplateStringsArray, ...values: unknown[]) => TemplateFragment;

export function html(
	stringsOrOwner: TemplateStringsArray | object,
	...values: unknown[]
): TemplateResult | ((strings: TemplateStringsArray, ...values: unknown[]) => TemplateFragment) {
	return isStrings(stringsOrOwner)
		? result(stringsOrOwner, values)
		: legacy(stringsOrOwner, values[0] as Document | undefined, "owned");
}

/** Materializes an inert template; active capture owns it, while standalone use requires `dispose()`. */
export const createFragment = (description: TemplateResult, owner: object, explicit?: Document): TemplateFragment => {
	assertOwner(owner);
	return render(description, owner, ownerDocument(owner, explicit), isCapturingBindings() ? "scoped" : "owned");
};

/** @deprecated Use owner-free `html` and capture-aware `createFragment()`. */
export const scopedHtml = (owner: object, explicit?: Document) => legacy(owner, explicit, "scoped");
