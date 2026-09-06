import type { AccordionActivation, AccordionController, DisclosureHandle } from "./_disclosure.js";
import { getAccordion, getDirectAccordion, registerDisclosure } from "./_disclosure.js";
import { upgradeProperty } from "./_upgrade.js";
import { BaseElement } from "./BaseElement.js";

/** Immutable state proposed by a collapsible's `beforechange` event. */
export interface CollapsibleChangeDetail {
	/** The open state that will be committed unless the transaction is canceled. */
	readonly open: boolean;

	/** The native button click that proposed the transition. */
	readonly sourceEvent: MouseEvent;
}

/** Events emitted by a standalone collapsible element. */
export interface CollapsibleEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<CollapsibleChangeDetail>;
}

type AttributeValue = string | null;

interface OwnedAttribute {
	author: AttributeValue;
	owned: AttributeValue;
}

interface InteractionSnapshot {
	readonly accordion: AccordionController | undefined;
	readonly accordionRevision: number | undefined;
	readonly button: HTMLButtonElement | null;
	readonly disabled: boolean;
	readonly open: boolean;
	readonly panel: HTMLElement | null;
}

const htmlNamespace = "http://www.w3.org/1999/xhtml";
const interactiveContent = "button, input, select, textarea, a[href], [contenteditable]:not([contenteditable='false'])";
const headingNames = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
let generatedId = 0;

const isElement = (value: unknown): value is Element =>
	typeof value === "object" && value !== null && "nodeType" in value && (value as Node).nodeType === 1;
const isHTMLElement = (element: Element): element is HTMLElement => element.namespaceURI === htmlNamespace;
const isButton = (element: Element): element is HTMLButtonElement =>
	isHTMLElement(element) && element.localName === "button";

const directButton = (element: Element): HTMLButtonElement | undefined => {
	if (isButton(element)) {
		return element;
	}
	if (!isHTMLElement(element) || !headingNames.has(element.localName)) {
		return;
	}

	return [...element.children].find(isButton);
};

/** A retained disclosure whose authored native button controls an authored panel. */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: the interface adds typed DOM event overloads only.
export class CollapsibleElement extends BaseElement {
	static readonly observedAttributes = ["disabled", "open", "value"];

	#accordion: AccordionController | undefined;
	#accordionDisabled = false;
	#button: HTMLButtonElement | undefined;
	#changing = false;
	#effectiveDisabled = false;
	readonly #handle: DisclosureHandle;
	#internals = this.attachInternals();
	#ownedAttributes = new Map<Element, Map<string, OwnedAttribute>>();
	#open = this.hasAttribute("open");
	#panel: HTMLElement | undefined;
	#reconcilingAccordion = false;
	#settingOpenAttribute = false;

	constructor() {
		super();

		const element = this;
		this.#handle = {
			get button() {
				return element.button;
			},
			get disabled() {
				return element.#getEffectiveDisabled();
			},
			element: this,
			get hasValue() {
				return element.hasAttribute("value");
			},
			get open() {
				return element.#open;
			},
			get value() {
				return element.value;
			},
			releaseAccordion(accordion) {
				element.#releaseAccordion(accordion);
			},
			setAccordionDisabled(accordion, disabled) {
				element.#setAccordionDisabled(accordion, disabled);
			},
			setOpen(open) {
				element.#setOpen(open);
			},
		};

		this.addEventListener("click", this.#onClick);

		for (const property of ["value", "disabled", "open"] as const) {
			upgradeProperty(this, property);
		}

		this.#refresh();
		registerDisclosure(this, this.#handle);
		this.#reconcileAccordion()?.memberChanged(this.#handle);
	}

	/** The controlled native button, either direct or a direct child of a direct heading. */
	get button(): HTMLButtonElement | null {
		this.#refresh();
		this.#reconcileAccordion();
		return this.#button ?? null;
	}

	/** The first direct element with `slot="panel"`; its identity and contents are retained while closed. */
	get panel(): HTMLElement | null {
		this.#refresh();
		return this.#panel ?? null;
	}

	/** Whether the panel is open. */
	get open(): boolean {
		this.#reconcileAccordion();
		return this.#open;
	}

	set open(value: boolean) {
		const open = Boolean(value);
		const accordion = this.#reconcileAccordion();

		if (accordion) {
			accordion.setOpen(this.#handle, open);
		} else {
			this.#setOpen(open);
		}
	}

	/** Whether this disclosure directly disables its trigger. An accordion may additionally disable it. */
	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	/** The explicit string identity used by a direct accordion. Empty strings are valid when the attribute is present. */
	get value(): string {
		return this.getAttribute("value") ?? "";
	}

	set value(value: string) {
		this.setAttribute("value", String(value));
	}

	attributeChangedCallback(name: string): void {
		if (name === "open") {
			if (this.#settingOpenAttribute) {
				return;
			}
			const open = this.hasAttribute("open");
			const accordion = this.#reconcileAccordion();

			if (accordion) {
				try {
					accordion.setOpen(this.#handle, open);
				} catch (error) {
					this.#setOpen(this.#open);
					throw error;
				}
			} else {
				this.#open = open;
				this.#synchronize();
			}
		} else {
			this.#synchronize();
			this.#reconcileAccordion()?.memberChanged(this.#handle);
		}
	}

	protected connect(connection: BaseElement.Connection): void {
		this.#refresh();
		this.#reconcileAccordion();
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => {
			this.#refresh();
			this.#reconcileAccordion()?.memberChanged(this.#handle);
			observeCurrent();
		});
		const observeCurrent = () => {
			observer.disconnect();
			observer.observe(this, { childList: true });

			for (const child of this.children) {
				observer.observe(child, { attributeFilter: ["slot"], attributes: true });
				if (isHTMLElement(child) && headingNames.has(child.localName)) {
					observer.observe(child, { attributeFilter: ["slot"], attributes: true, childList: true });
				}
			}

			if (this.#button) {
				observer.observe(this.#button, {
					attributeFilter: ["aria-controls", "aria-expanded", "disabled", "id", "type"],
					attributes: true,
				});
			}
			if (this.#panel) {
				observer.observe(this.#panel, {
					attributeFilter: ["aria-labelledby", "hidden", "id", "role", "slot"],
					attributes: true,
				});
			}
		};
		observeCurrent();
		connection.addCleanup(() => {
			observer.disconnect();
			if (getDirectAccordion(this.#handle) !== this.#accordion) {
				this.#reconcileAccordion();
			}
		});
	}

	protected moved(): void {
		this.#reconcileAccordion();
	}

	#onClick = (sourceEvent: MouseEvent): void => {
		if (sourceEvent.defaultPrevented || this.#changing) {
			return;
		}
		const button = this.button;
		if (!button || !this.#eventUsesButton(sourceEvent, button)) {
			return;
		}

		const before = this.#interactionSnapshot();
		if (before.accordion?.changing || before.disabled) {
			return;
		}
		let activation: AccordionActivation | undefined;
		if (before.accordion && !(activation = before.accordion.beginActivation(this.#handle))) {
			return;
		}

		this.#changing = true;
		try {
			const open = !before.open;
			const detail = Object.freeze({ open, sourceEvent }) satisfies CollapsibleChangeDetail;
			const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
			const proposal = new EventConstructor<CollapsibleChangeDetail>("beforechange", {
				bubbles: true,
				cancelable: true,
				composed: true,
				detail,
			});

			if (
				!this.dispatchEvent(proposal) ||
				!this.#interactionSnapshotEquals(before, this.#interactionSnapshot())
			) {
				return;
			}

			if (before.accordion && activation) {
				before.accordion.activate(activation, this.#handle, open, sourceEvent, () =>
					this.#dispatchChangeEvents(),
				);
			} else {
				this.#setOpen(open);
				const after = this.#interactionSnapshot();
				if (
					after.accordion !== undefined ||
					after.button !== before.button ||
					after.disabled ||
					after.open !== open ||
					after.panel !== before.panel
				) {
					return;
				}
				this.#dispatchChangeEvents();
			}
		} finally {
			this.#changing = false;
			if (before.accordion && activation) {
				before.accordion.endActivation(activation);
			}
		}
	};

	#eventUsesButton(event: Event, button: HTMLButtonElement): boolean {
		for (const node of event.composedPath()) {
			if (node === button) {
				return true;
			}
			if (isElement(node) && node.matches(interactiveContent)) {
				return false;
			}
		}

		return false;
	}

	#dispatchChangeEvents(): void {
		const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
		this.dispatchEvent(new EventConstructor("input", { bubbles: true, composed: true }));
		this.dispatchEvent(new EventConstructor("change", { bubbles: true }));
	}

	#interactionSnapshot(): InteractionSnapshot {
		const accordion = this.#reconcileAccordion();
		return {
			accordion,
			accordionRevision: accordion?.revision,
			button: this.button,
			disabled: this.#getEffectiveDisabled(),
			open: this.#open,
			panel: this.panel,
		};
	}

	#interactionSnapshotEquals(left: InteractionSnapshot, right: InteractionSnapshot): boolean {
		return (
			left.accordion === right.accordion &&
			left.accordionRevision === right.accordionRevision &&
			left.button === right.button &&
			left.disabled === right.disabled &&
			left.open === right.open &&
			left.panel === right.panel
		);
	}

	#getEffectiveDisabled(): boolean {
		this.#refresh();
		this.#reconcileAccordion();
		return this.#effectiveDisabled;
	}

	#setAccordionDisabled(accordion: AccordionController, disabled: boolean): void {
		const claimed = this.#claimAccordion(accordion);
		if (claimed === undefined || (!claimed && this.#accordionDisabled === disabled)) {
			return;
		}
		this.#accordionDisabled = disabled;
		this.#synchronize();
	}

	#claimAccordion(accordion: AccordionController): boolean | undefined {
		if (getDirectAccordion(this.#handle) !== accordion) {
			return;
		}
		if (this.#accordion === accordion) {
			return false;
		}
		this.#accordion = accordion;
		this.#accordionDisabled = false;
		return true;
	}

	#releaseAccordion(accordion: AccordionController): void {
		if (this.#accordion !== accordion) {
			return;
		}
		this.#accordion = undefined;
		this.#accordionDisabled = false;
		this.#synchronize();
	}

	#reconcileAccordion(): AccordionController | undefined {
		if (this.#reconcilingAccordion) {
			return this.#accordion;
		}

		this.#reconcilingAccordion = true;
		try {
			const accordion = getAccordion(this.#handle);
			if (!accordion && this.#accordion) {
				this.#releaseAccordion(this.#accordion);
			}
			return accordion;
		} finally {
			this.#reconcilingAccordion = false;
		}
	}

	#setOpen(open: boolean): void {
		if (this.#open === open) {
			this.#synchronize();
			return;
		}
		this.#open = open;
		this.#settingOpenAttribute = true;
		try {
			this.toggleAttribute("open", open);
		} finally {
			this.#settingOpenAttribute = false;
		}
		this.#synchronize();
	}

	#refresh(): void {
		const button = [...this.children].map(directButton).find((candidate) => candidate !== undefined);
		const panel = [...this.children].find(
			(child): child is HTMLElement => isHTMLElement(child) && child.getAttribute("slot") === "panel",
		);

		if (button !== this.#button) {
			if (this.#button) {
				this.#release(this.#button);
			}
			this.#button = button;
		}
		if (panel !== this.#panel) {
			if (this.#panel) {
				this.#release(this.#panel);
			}
			this.#panel = panel;
		}

		this.#synchronize();
	}

	#synchronize(): void {
		const button = this.#button;
		const panel = this.#panel;
		const authorDisabled = button ? this.#capture(button, "disabled").author !== null : false;
		const controlledDisabled = this.disabled || this.#accordionDisabled || authorDisabled;

		if (button) {
			const buttonId = this.#id(button, "trigger");
			this.#own(button, "type", "button");
			this.#own(button, "aria-expanded", String(this.#open));
			this.#own(button, "aria-controls", panel ? this.#id(panel, "panel") : null);
			this.#own(button, "disabled", controlledDisabled ? "" : null);

			if (panel) {
				this.#own(panel, "role", "region");
				this.#own(panel, "aria-labelledby", buttonId);
			}
		} else if (panel) {
			this.#id(panel, "panel");
			this.#own(panel, "role", "region");
			this.#own(panel, "aria-labelledby", null);
		}

		if (panel) {
			if (!this.#open) {
				this.#returnFocus(panel, button);
			}
			this.#own(panel, "hidden", this.#open ? null : "");
		}

		this.#effectiveDisabled = button ? button.matches(":disabled") : controlledDisabled;
		this.#setState("open", this.#open);
		this.#setState("closed", !this.#open);
		this.#setState("disabled", controlledDisabled);
	}

	#returnFocus(panel: HTMLElement, button: HTMLButtonElement | undefined): void {
		const active = this.ownerDocument.activeElement;
		if (!active || !panel.contains(active)) {
			return;
		}

		button?.focus({ preventScroll: true });
		const remaining = this.ownerDocument.activeElement;
		if (remaining && panel.contains(remaining) && "blur" in remaining && typeof remaining.blur === "function") {
			remaining.blur();
		}
	}

	#setState(state: string, present: boolean): void {
		if (present) {
			this.#internals.states.add(state);
		} else {
			this.#internals.states.delete(state);
		}
	}

	#id(element: HTMLElement, part: "panel" | "trigger"): string {
		const id = element.id || `${this.localName || "base-collapsible"}-${part}-${++generatedId}`;
		this.#own(element, "id", id);
		return id;
	}

	#capture(element: Element, name: string): OwnedAttribute {
		let attributes = this.#ownedAttributes.get(element);
		if (!attributes) {
			this.#ownedAttributes.set(element, (attributes = new Map()));
		}

		const current = element.getAttribute(name);
		let state = attributes.get(name);
		if (!state) {
			state = { author: current, owned: current };
			attributes.set(name, state);
		} else if (current !== state.owned) {
			state.author = current;
		}

		return state;
	}

	#own(element: Element, name: string, value: AttributeValue): void {
		const state = this.#capture(element, name);
		const current = element.getAttribute(name);
		if (current !== value) {
			if (value === null) {
				element.removeAttribute(name);
			} else {
				element.setAttribute(name, value);
			}
		}
		state.owned = value;
	}

	#release(element: Element): void {
		const attributes = this.#ownedAttributes.get(element);
		if (!attributes) {
			return;
		}

		for (const [name, state] of attributes) {
			if (element.getAttribute(name) !== state.owned) {
				continue;
			}
			if (state.author === null) {
				element.removeAttribute(name);
			} else {
				element.setAttribute(name, state.author);
			}
		}

		this.#ownedAttributes.delete(element);
	}
}

/** Typed event listeners available on collapsible elements. */
export interface CollapsibleElement {
	addEventListener<Type extends keyof CollapsibleEventMap>(
		type: Type,
		listener: (this: CollapsibleElement, event: CollapsibleEventMap[Type]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	): void;

	removeEventListener<Type extends keyof CollapsibleEventMap>(
		type: Type,
		listener: (this: CollapsibleElement, event: CollapsibleEventMap[Type]) => unknown,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions,
	): void;
}
