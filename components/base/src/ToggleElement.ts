import type { ToggleGroupController, ToggleHandle } from "./_toggle-group.js";
import { getDirectToggleGroup, getToggleGroup, registerToggle } from "./_toggle-group.js";
import { upgradeProperty } from "./_upgrade.js";
import { BaseElement } from "./BaseElement.js";

/** Immutable state proposed by a toggle's `beforechange` event. */
export interface ToggleChangeDetail {
	/** The pressed state that will be committed unless the transaction is canceled. */
	readonly pressed: boolean;

	/** The native button click that proposed the transition. */
	readonly sourceEvent: MouseEvent;
}

/** Events emitted by a standalone toggle element. */
export interface ToggleEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<ToggleChangeDetail>;
}

type AttributeValue = string | null;

interface OwnedAttribute {
	author: AttributeValue;
	owned: AttributeValue;
}

const htmlNamespace = "http://www.w3.org/1999/xhtml";
const interactiveContent = "button, input, select, textarea, a[href], [contenteditable]:not([contenteditable='false'])";

const isElement = (value: unknown): value is Element =>
	typeof value === "object" && value !== null && "nodeType" in value && (value as Node).nodeType === 1;
const isButton = (element: Element): element is HTMLButtonElement =>
	element.namespaceURI === htmlNamespace && element.localName === "button";

/** A pressed-state control whose first direct native button owns focus and activation. */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: the interface adds typed DOM event overloads only.
export class ToggleElement extends BaseElement {
	static readonly observedAttributes = ["disabled", "pressed", "value"];

	#button: HTMLButtonElement | undefined;
	#changing = false;
	#effectiveDisabled = false;
	#groupDisabled = false;
	#group: ToggleGroupController | undefined;
	#groupTabIndex: "-1" | "0" | undefined;
	readonly #handle: ToggleHandle;
	#internals = this.attachInternals();
	#ownedAttributes = new Map<Element, Map<string, OwnedAttribute>>();
	#pressed = this.hasAttribute("pressed");
	#reconcilingGroup = false;
	#settingPressedAttribute = false;

	constructor() {
		super();

		const element = this;
		this.#handle = {
			element: this,
			get button() {
				return element.button;
			},
			get disabled() {
				return element.#getEffectiveDisabled();
			},
			get hasValue() {
				return element.hasAttribute("value");
			},
			get pressed() {
				return element.#pressed;
			},
			get value() {
				return element.value;
			},
			releaseGroup(group) {
				element.#releaseGroup(group);
			},
			setGroupDisabled(group, disabled) {
				element.#setGroupDisabled(group, disabled);
			},
			setGroupTabIndex(group, tabIndex) {
				element.#setGroupTabIndex(group, tabIndex);
			},
			setPressed(pressed) {
				element.#setPressed(pressed);
			},
		};
		this.addEventListener("click", this.#onClick);

		for (const property of ["value", "disabled", "pressed"] as const) {
			upgradeProperty(this, property);
		}

		this.#refresh();
		registerToggle(this, this.#handle);
		this.#reconcileGroup()?.memberChanged(this.#handle);
	}

	/** The first direct native button, which remains the sole focus and activation identity. */
	get button(): HTMLButtonElement | null {
		this.#refresh();
		this.#reconcileGroup();
		return this.#button ?? null;
	}

	/** Whether the toggle is currently pressed. */
	get pressed(): boolean {
		this.#reconcileGroup();
		return this.#pressed;
	}

	set pressed(value: boolean) {
		const pressed = Boolean(value);
		const group = this.#reconcileGroup();

		if (group) {
			group.setPressed(this.#handle, pressed);
		} else {
			this.#setPressed(pressed);
		}
	}

	/** Whether this toggle directly disables its button. A group may additionally disable it. */
	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	/** The explicit string identity used by a direct toggle group. Empty strings are valid when the attribute is present. */
	get value(): string {
		return this.getAttribute("value") ?? "";
	}

	set value(value: string) {
		this.setAttribute("value", String(value));
	}

	attributeChangedCallback(name: string): void {
		if (name === "pressed") {
			if (this.#settingPressedAttribute) {
				return;
			}
			const pressed = this.hasAttribute("pressed");
			const group = this.#reconcileGroup();

			if (group) {
				try {
					group.setPressed(this.#handle, pressed);
				} catch (error) {
					this.#setPressed(this.#pressed);
					throw error;
				}
			} else {
				this.#pressed = pressed;
				this.#synchronize();
			}
		} else {
			this.#synchronize();
			this.#reconcileGroup()?.memberChanged(this.#handle);
		}
	}

	protected connect(connection: BaseElement.Connection): void {
		this.#refresh();
		this.#reconcileGroup();
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => {
			this.#refresh();
			this.#reconcileGroup()?.memberChanged(this.#handle);
		});
		observer.observe(this, {
			attributeFilter: ["aria-pressed", "disabled", "role", "tabindex", "type"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		connection.addCleanup(() => {
			observer.disconnect();
			if (getDirectToggleGroup(this.#handle) !== this.#group) {
				this.#reconcileGroup();
			}
		});
	}

	protected moved(): void {
		this.#reconcileGroup();
	}

	#onClick = (sourceEvent: MouseEvent): void => {
		if (sourceEvent.defaultPrevented || this.#changing) {
			return;
		}
		const button = this.button;
		if (!button || !this.#eventUsesButton(sourceEvent, button)) {
			return;
		}

		const initialGroup = this.#reconcileGroup();
		if (this.#getEffectiveDisabled()) {
			return;
		}

		const previousPressed = this.#pressed;
		const pressed = !previousPressed;
		const lease = initialGroup?.begin(this.#handle, pressed);
		if (initialGroup && !lease) {
			return;
		}

		this.#changing = true;
		try {
			const detail = Object.freeze({ pressed, sourceEvent }) satisfies ToggleChangeDetail;
			const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
			const proposal = new EventConstructor<ToggleChangeDetail>("beforechange", {
				bubbles: true,
				cancelable: true,
				composed: true,
				detail,
			});

			if (!this.dispatchEvent(proposal)) {
				return;
			}
			if (this.#pressed !== previousPressed || this.button !== button || this.#getEffectiveDisabled()) {
				return;
			}

			const group = this.#reconcileGroup();
			if (group !== initialGroup) {
				return;
			}
			if (lease) {
				lease.complete(sourceEvent, () => this.#dispatchChangeEvents());
				return;
			}

			this.#setPressed(pressed);
			this.#dispatchChangeEvents();
		} finally {
			lease?.release();
			this.#changing = false;
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

	#getEffectiveDisabled(): boolean {
		this.#refresh();
		this.#reconcileGroup();
		return this.#effectiveDisabled;
	}

	#setGroupDisabled(group: ToggleGroupController, disabled: boolean): void {
		const claimed = this.#claimGroup(group);
		if (claimed === undefined) {
			return;
		}
		if (!claimed && this.#groupDisabled === disabled) {
			return;
		}
		this.#groupDisabled = disabled;
		this.#synchronize();
	}

	#setGroupTabIndex(group: ToggleGroupController, tabIndex: "-1" | "0" | undefined): void {
		const claimed = this.#claimGroup(group);
		if (claimed === undefined) {
			return;
		}
		if (!claimed && this.#groupTabIndex === tabIndex) {
			return;
		}
		this.#groupTabIndex = tabIndex;
		this.#synchronize();
	}

	#claimGroup(group: ToggleGroupController): boolean | undefined {
		if (getDirectToggleGroup(this.#handle) !== group) {
			return;
		}
		if (this.#group === group) {
			return false;
		}
		this.#group = group;
		this.#groupDisabled = false;
		this.#groupTabIndex = undefined;
		return true;
	}

	#releaseGroup(group: ToggleGroupController): void {
		if (this.#group !== group) {
			return;
		}
		this.#group = undefined;
		this.#groupDisabled = false;
		this.#groupTabIndex = undefined;
		this.#synchronize();
	}

	#reconcileGroup(): ToggleGroupController | undefined {
		if (this.#reconcilingGroup) {
			return this.#group;
		}

		this.#reconcilingGroup = true;
		try {
			const group = getToggleGroup(this.#handle);
			if (!group && this.#group) {
				this.#releaseGroup(this.#group);
			}
			return group;
		} finally {
			this.#reconcilingGroup = false;
		}
	}

	#setPressed(pressed: boolean): void {
		this.#pressed = pressed;
		this.#settingPressedAttribute = true;
		try {
			this.toggleAttribute("pressed", pressed);
		} finally {
			this.#settingPressedAttribute = false;
		}
		this.#synchronize();
	}

	#refresh(): void {
		const button = [...this.children].find(isButton);
		if (button !== this.#button) {
			if (this.#button) {
				this.#release(this.#button);
			}
			this.#button = button;
		}

		this.#synchronize();
	}

	#synchronize(): void {
		const button = this.#button;
		const authorDisabled = button ? this.#capture(button, "disabled").author !== null : false;
		const controlledDisabled = this.disabled || this.#groupDisabled || authorDisabled;

		if (!button) {
			this.#effectiveDisabled = controlledDisabled;
			this.#setState("pressed", this.#pressed);
			this.#setState("disabled", controlledDisabled);
			return;
		}

		this.#own(button, "type", "button");
		this.#own(button, "role", "button");
		this.#own(button, "aria-pressed", String(this.#pressed));
		this.#own(button, "disabled", controlledDisabled ? "" : null);

		if (this.#groupTabIndex === undefined) {
			this.#releaseAttribute(button, "tabindex");
		} else {
			this.#own(button, "tabindex", this.#groupTabIndex);
		}

		this.#effectiveDisabled = button.matches(":disabled");
		this.#setState("pressed", this.#pressed);
		this.#setState("disabled", controlledDisabled);
	}

	#setState(state: string, present: boolean): void {
		if (present) {
			this.#internals.states.add(state);
		} else {
			this.#internals.states.delete(state);
		}
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

	#releaseAttribute(element: Element, name: string): void {
		const attributes = this.#ownedAttributes.get(element);
		const state = attributes?.get(name);
		if (!attributes || !state) {
			return;
		}

		if (element.getAttribute(name) === state.owned) {
			if (state.author === null) {
				element.removeAttribute(name);
			} else {
				element.setAttribute(name, state.author);
			}
		}
		attributes.delete(name);
		if (attributes.size === 0) {
			this.#ownedAttributes.delete(element);
		}
	}

	#release(element: Element): void {
		const names = [...(this.#ownedAttributes.get(element)?.keys() ?? [])];
		for (const name of names) {
			this.#releaseAttribute(element, name);
		}
	}
}

/** Typed event listeners available on toggle elements. */
export interface ToggleElement {
	addEventListener<Type extends keyof ToggleEventMap>(
		type: Type,
		listener: (this: ToggleElement, event: ToggleEventMap[Type]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	): void;

	removeEventListener<Type extends keyof ToggleEventMap>(
		type: Type,
		listener: (this: ToggleElement, event: ToggleEventMap[Type]) => unknown,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions,
	): void;
}
