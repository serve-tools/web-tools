import { PersistentFragment } from "@serve-tools/client-dom-fragment";
import { Signal } from "@serve-tools/signal";
import { captureBinding, captureBindingResource, isCapturingBindings } from "./scope.js";

export { PersistentFragment };

/** A one-shot DOM template whose bindings are retired explicitly, independently of DOM placement. */
export interface TemplateFragment extends DocumentFragment {
	/** Stops this template's effects, listeners, and directive resources without removing its DOM. */
	dispose(): void;
}

/** Configures one element and optionally returns synchronous cleanup owned by its template. */
export type TemplateDirective = (element: Element) => void | (() => void);

type Watcher = InstanceType<typeof Signal.subtle.Watcher> & { reference?: WeakRef<Watcher> };
type Computed = InstanceType<typeof Signal.Computed>;
type Cleanup = () => void;
type BindingEffect = (owner: object, run: () => void, own: (cleanup: Cleanup) => void) => void;
type ListenerValue = (EventListener | EventListenerObject) & AddEventListenerOptions;

interface Listener extends EventListenerObject {
	owner: object | undefined;
	value: ListenerValue | undefined;
	capture: boolean | undefined;
	once: boolean | undefined;
	passive: boolean | undefined;
	signal: AbortSignal | undefined;
}

const owners = new WeakMap<object, Watcher>();
const activeEffects = new WeakSet<Computed>();
const pending = new Set<WeakRef<Watcher>>();

const combineErrors = (errors: unknown[], message: string): unknown =>
	errors.length === 1 ? errors[0] : new AggregateError(errors, message);

const flush = (): void => {
	const effects: Computed[] = [];

	let errors: unknown[] | undefined;

	for (const reference of pending) {
		const watcher = reference.deref();

		if (!watcher) {
			continue;
		}

		for (const computed of watcher.getPending()) {
			effects.push(computed);
		}

		watcher.watch();
	}

	pending.clear();

	for (const computed of effects) {
		if (!activeEffects.has(computed)) {
			continue;
		}

		try {
			computed.get();
		} catch (error) {
			(errors ??= []).push(error);
		}
	}

	if (errors) {
		throw combineErrors(errors, "Multiple effects failed");
	}
};

function notify(this: Watcher): void {
	if (!pending.size) {
		queueMicrotask(flush);
	}

	pending.add((this.reference ??= new WeakRef(this)));
}

// Externally retained signals or stop handles can retain an owner; weak scheduling is not a destructor.
const ownedEffect = (owner: object, run: () => void, own: (cleanup: Cleanup) => void): void => {
	let watcher = owners.get(owner);

	if (!watcher) {
		watcher = new Signal.subtle.Watcher(notify);

		owners.set(owner, watcher);
	}

	const computed = new Signal.Computed(run);

	activeEffects.add(computed);

	own(() => {
		if (activeEffects.delete(computed)) {
			watcher.unwatch(computed);
		}
	});

	if (!activeEffects.has(computed)) {
		return;
	}

	watcher.watch(computed);

	computed.get();
};

const scopedEffect: BindingEffect = (_owner, run, own) => {
	const binding = captureBinding(undefined, run);

	if (!binding) {
		throw new TypeError("scopedHtml() must be used inside BindingScope.capture()");
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
	const value = this.value;

	if (typeof value === "function") {
		value.call(this.owner, event);
	} else {
		value?.handleEvent(event);
	}
}

const isNode = (value: unknown): value is Node => {
	if (!value || typeof value !== "object" || typeof (value as Node).nodeType !== "number") {
		return false;
	}

	try {
		// Adoption changes ownerDocument, not the node's creation realm or native brand.
		return Node.prototype.isSameNode.call(value, value as Node);
	} catch {
		return false;
	}
};

/** Snapshots iterable inputs before moving nodes from potentially live collections. */
const collect = (value: unknown, items: (Node | PersistentFragment | string)[] = []) => {
	if (isNode(value) || value instanceof PersistentFragment) {
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

// biome-ignore lint/suspicious/noControlCharactersInRegex: A reserved sentinel marks template holes before HTML parsing.
const tokens = /<[a-z](?:[^>"']|"[^"]*"|'[^']*')*>|\x01/gi;

// biome-ignore lint/suspicious/noControlCharactersInRegex: Whole-value bindings consume the reserved sentinel.
const bindings = /([^\s\\>"'=]+)\s*=\s*(['"]?)\x01\2(?=[\s/>])|\x01/g;

const createHTML =
	(bindEffect: BindingEffect, scoped: boolean) =>
	(owner: object, ownerDocument: Document = (owner as Node).ownerDocument ?? document) =>
	(strings: TemplateStringsArray, ...values: unknown[]): TemplateFragment => {
		if (owner === null || (typeof owner !== "object" && typeof owner !== "function")) {
			throw new TypeError("A template owner must be an object");
		}

		if (scoped && !isCapturingBindings()) {
			throw new TypeError("scopedHtml() must be used inside BindingScope.capture()");
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

		const fragment = template.content as TemplateFragment;
		const cleanups: Cleanup[] = [];

		let disposed = false;
		let releaseScope: Cleanup | undefined;

		const dispose = (errors?: unknown[]): void => {
			if (disposed) {
				if (errors) {
					throw combineErrors(errors, "Template cleanup failed");
				}

				return;
			}

			disposed = true;

			const release = releaseScope;

			releaseScope = undefined;

			try {
				release?.();
			} catch (error) {
				(errors ??= []).push(error);
			}

			for (const cleanup of cleanups.splice(0)) {
				try {
					cleanup();
				} catch (error) {
					(errors ??= []).push(error);
				}
			}

			if (errors) {
				throw combineErrors(errors, "Template cleanup failed");
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

		const walker = ownerDocument.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
		const targets: { node: Element | Comment; part: Attr | Comment; index: number }[] = [];
		const found = new Set<number>();

		// Validate every hole before directives or effects can run; collect before bindings change the tree.
		while (walker.nextNode()) {
			const node = walker.currentNode as Element | Comment;

			for (const part of node.nodeType === Node.COMMENT_NODE
				? [node as Comment]
				: [...(node as Element).attributes]) {
				const key = part.nodeType === Node.COMMENT_NODE ? (part as Comment).data : (part as Attr).name;

				if (!key.startsWith(prefix)) {
					continue;
				}

				const index = Number(key.slice(prefix.length));

				targets.push({ node, part, index });

				found.add(index);
			}
		}

		if (found.size !== values.length || targets.length !== values.length) {
			throw new SyntaxError("Use child bindings or whole attribute values; this template context is unsupported");
		}

		try {
			if (scoped) {
				const resource = captureBindingResource(dispose);

				if (!resource) {
					throw new TypeError("scopedHtml() must be used inside BindingScope.capture()");
				}

				releaseScope = resource.dispose;
			}

			for (const { node, part, index } of targets) {
				if (disposed) {
					break;
				}

				const value = values[index];

				let write: (value: any) => void;

				if (part === node) {
					const text = ownerDocument.createTextNode("");

					let end: Comment | undefined;
					let content: Node | PersistentFragment | undefined;

					node.replaceWith(text);

					write = (value: unknown) => {
						if (content && value === content) {
							return;
						}

						const nodeValue = isNode(value) || value instanceof PersistentFragment;

						const items =
							!nodeValue && typeof value !== "string" && value != null && Symbol.iterator in Object(value)
								? collect(value)
								: undefined;

						content = undefined;

						if (end) {
							while (text.nextSibling !== end) {
								const next = text.nextSibling;

								if (!next) {
									throw new DOMException(
										"Template child boundaries were removed",
										"InvalidStateError",
									);
								}

								const region = PersistentFragment.fromNode(next);

								if (region) {
									region.remove();
								} else {
									next.remove();
								}
							}
						}

						if (!nodeValue && !items) {
							text.data = String(value ?? "");
						} else {
							if (!end) {
								text.after((end = ownerDocument.createComment("")));
							}

							text.data = "";

							if (items) {
								for (const item of items) {
									insert(end, item);
								}
							} else {
								insert(end, value as Node | PersistentFragment);
							}

							if (nodeValue) {
								content = value as Node | PersistentFragment;
							}
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

						write = (value: ListenerValue | null | undefined) => {
							const capture = value?.capture;
							const once = value?.once;
							const passive = value?.passive;
							const signal = value?.signal;

							if (disposed && value != null) {
								return;
							}

							if (
								!listener ||
								value == null ||
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

								if (value != null) {
									const next = { handleEvent, owner, value, capture, once, passive, signal };

									element.addEventListener(type, next, {
										...(capture === undefined ? {} : { capture }),
										...(once === undefined ? {} : { once }),
										...(passive === undefined ? {} : { passive }),
										...(signal === undefined ? {} : { signal }),
									});

									listener = next;
								}
							} else {
								listener.value = value;
							}
						};

						own(() => write(null));
					} else if (name.startsWith(".")) {
						const property = name.slice(1);

						write = (value: unknown) => {
							(element as unknown as Record<string, unknown>)[property] = value;
						};
					} else {
						write = (value: unknown) => {
							if (value === null) {
								element.removeAttribute(name);
							} else {
								element.setAttribute(name, String(value));
							}
						};
					}
				}

				const apply = (value: unknown): void => {
					if (!disposed) {
						write(value);
					}
				};

				if (Signal.isState(value) || Signal.isComputed(value)) {
					bindEffect(owner, () => apply(value.get()), own);
				} else {
					apply(value);
				}
			}
		} catch (error) {
			dispose([error]);
		}

		return fragment;
	};

/**
 * Creates persistent owner-local tagged templates with child, attribute, property, event, and directive bindings.
 * Removing or hiding DOM never disposes a template. The returned fragment's dispose() owns only its bindings.
 */
export const html = createHTML(ownedEffect, false);

/**
 * Creates a template whose reactive bindings follow the current BindingScope and whose terminal resources it owns.
 * The tag must run synchronously inside BindingScope.capture(). Suspension preserves listeners and directives.
 */
export const scopedHtml = createHTML(scopedEffect, true);
