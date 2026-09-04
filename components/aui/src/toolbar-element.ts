import type { CompositeEntry } from "./.composite.js";
import {
	CompositeCollection,
	isHTMLElement,
	isNativelyDisabled,
	pathElement,
	textEditorConsumesArrow,
} from "./.composite.js";
import { directMenuChildren } from "./.menu.js";
import { AttributeOwner } from "./.ownership.js";
import { getToggle } from "./.toggle-group.js";
import { upgradeProperty } from "./.upgrade.js";
import { AUIElement } from "./aui-element.js";

/** A toolbar item addressed by DOM order, ID, or native focus element. */
export type ToolbarTarget = number | string | HTMLElement;

const directControl = (element: Element): element is HTMLElement =>
	isHTMLElement(element) &&
	(element.localName === "button" ||
		element.localName === "input" ||
		element.localName === "select" ||
		element.localName === "textarea" ||
		(element.localName === "a" && element.hasAttribute("href")));

/** Coordinates a single roving focus stop across native toolbar controls. */
export class ToolbarElement extends AUIElement {
	static readonly observedAttributes = ["disabled", "loop-focus", "orientation"];

	readonly #collection = new CompositeCollection(this, () => this.#resolveEntries());
	#controlled = new Set<HTMLElement>();
	readonly #internals = this.attachInternals();
	readonly #owner = new AttributeOwner();

	constructor() {
		super();
		this.#internals.role = "toolbar";
		for (const property of ["disabled", "loopFocus", "orientation"] as const) {
			upgradeProperty(this, property);
		}
		this.#synchronizeState();
	}

	/** Native focus targets controlled by this toolbar. */
	get items(): readonly HTMLElement[] {
		return Object.freeze(this.#collection.entries.map((entry) => entry.element));
	}

	/** The current roving-focus target. */
	get activeItem(): HTMLElement | null {
		return this.#collection.activeElement;
	}

	/** Toolbar axis. Defaults to horizontal. */
	get orientation(): "horizontal" | "vertical" {
		return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";
	}

	set orientation(value: "horizontal" | "vertical") {
		this.setAttribute("orientation", value === "vertical" ? "vertical" : "horizontal");
	}

	/** Whether arrow navigation wraps. Defaults to true. */
	get loopFocus(): boolean {
		return this.getAttribute("loop-focus") !== "false";
	}

	set loopFocus(value: boolean) {
		this.setAttribute("loop-focus", String(Boolean(value)));
	}

	/** Whether the toolbar prevents activation of all current items. */
	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	/** Focuses an enabled current toolbar item without activating it. */
	focusItem(target: ToolbarTarget, options?: FocusOptions): boolean {
		const item = this.#resolveTarget(target);
		return item ? this.#collection.focus(item, options) : false;
	}

	attributeChangedCallback(): void {
		this.#refresh();
		this.#synchronizeState();
	}

	protected override connect(connection: AUIElement.Connection): void {
		this.#refresh();
		this.addEventListener("click", this.#onActivation, { capture: true, signal: connection.signal });
		this.addEventListener("pointerdown", this.#onActivation, { capture: true, signal: connection.signal });
		this.addEventListener("focusin", this.#onFocusIn, { signal: connection.signal });
		this.addEventListener("keydown", this.#onKeyDown, { capture: true, signal: connection.signal });
		this.addEventListener("aui-menuchange", this.#refreshFromEvent, { signal: connection.signal });

		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: [
				"aria-disabled",
				"aria-label",
				"disabled",
				"hidden",
				"href",
				"id",
				"inert",
				"role",
				"slot",
				"tabindex",
				"type",
			],
			attributes: true,
			childList: true,
			subtree: true,
		});
		connection.addCleanup(() => {
			observer.disconnect();
			this.#collection.release();
			for (const item of this.#controlled) {
				this.#owner.releaseAttribute(item, "aria-disabled");
			}
			this.#controlled.clear();
		});
	}

	#onActivation = (event: Event): void => {
		const item = pathElement(event, this.items);
		if (!item || (!this.disabled && item.getAttribute("aria-disabled") !== "true")) {
			return;
		}
		event.preventDefault();
		event.stopImmediatePropagation();
	};

	#onFocusIn = (event: FocusEvent): void => {
		if (isHTMLElement(event.target) && this.#collection.contains(event.target)) {
			this.#collection.setActive(event.target);
		}
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		const item = pathElement(event, this.items);
		if (!item) {
			return;
		}
		if (
			item.localName === "select" ||
			((event.key === "Home" || event.key === "End") &&
				(item.localName === "input" || item.localName === "textarea"))
		) {
			return;
		}
		const rtl = this.ownerDocument.defaultView?.getComputedStyle(this).direction === "rtl";
		if (textEditorConsumesArrow(item, event, this.orientation, Boolean(rtl))) {
			return;
		}
		const movement = this.#collection.move(item, event.key, this.orientation, this.loopFocus);
		if (movement) {
			event.preventDefault();
		}
	};

	#refreshFromEvent = (): void => this.#refresh();

	#resolveEntries(): readonly CompositeEntry[] {
		const menus = new Map(directMenuChildren(this).map((menu) => [menu.element, menu]));
		const entries: CompositeEntry[] = [];
		for (const child of this.children) {
			if (directControl(child)) {
				entries.push(this.#entry(child));
				continue;
			}
			const menu = menus.get(child as HTMLElement);
			if (menu?.trigger) {
				entries.push(this.#entry(menu.trigger));
				continue;
			}
			const toggle = getToggle(child);
			if (toggle?.button) {
				entries.push({ disabled: toggle.disabled, element: toggle.button, text: this.#text(toggle.button) });
			}
		}
		return entries;
	}

	#entry(element: HTMLElement): CompositeEntry {
		return { disabled: isNativelyDisabled(element), element, text: this.#text(element) };
	}

	#refresh(): void {
		const items = new Set(this.#resolveEntries().map((entry) => entry.element));
		for (const item of this.#controlled) {
			if (!items.has(item)) {
				this.#owner.releaseAttribute(item, "aria-disabled");
			}
		}
		for (const item of items) {
			if (this.disabled) {
				this.#owner.own(item, "aria-disabled", "true");
			} else {
				this.#owner.releaseAttribute(item, "aria-disabled");
			}
		}
		this.#controlled = items;
		this.#collection.refresh();
		this.#synchronizeState();
	}

	#resolveTarget(target: ToolbarTarget): HTMLElement | undefined {
		const items = this.items;
		if (typeof target === "number") {
			return items[target];
		}
		if (typeof target === "string") {
			return items.find((item) => item.id === target);
		}
		return items.includes(target) ? target : undefined;
	}

	#text(element: HTMLElement): string {
		return element.getAttribute("aria-label") ?? element.textContent ?? "";
	}

	#synchronizeState(): void {
		this.#internals.ariaOrientation = this.orientation;
		if (this.orientation === "horizontal") {
			this.#internals.states.add("horizontal");
			this.#internals.states.delete("vertical");
		} else {
			this.#internals.states.add("vertical");
			this.#internals.states.delete("horizontal");
		}
		if (this.disabled) {
			this.#internals.states.add("disabled");
		} else {
			this.#internals.states.delete("disabled");
		}
	}
}
