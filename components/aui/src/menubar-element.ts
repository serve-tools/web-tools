import type { CompositeEntry } from "./.composite.js";
import { CompositeCollection, isHTMLElement, isNativelyDisabled, pathElement } from "./.composite.js";
import type { MenuHandle } from "./.menu.js";
import { directMenuChildren } from "./.menu.js";
import { AttributeOwner } from "./.popover.js";
import { AUIElement } from "./aui-element.js";

/** A menubar target addressed by DOM order, ID, or focus element. */
export type MenubarTarget = number | string | HTMLElement;

/** Coordinates top-level native menu triggers and command items. */
export class MenubarElement extends AUIElement {
	static readonly observedAttributes = ["loop-focus", "orientation"];

	readonly #collection = new CompositeCollection(this, () => this.#resolveEntries());
	#controlledTriggers = new Set<HTMLElement>();
	readonly #internals = this.attachInternals();
	readonly #owner = new AttributeOwner();

	constructor() {
		super();
		this.#internals.role = "menubar";
		for (const property of ["loopFocus", "orientation"] as const) {
			this.#upgradeProperty(property);
		}
		this.#synchronizeRole();
	}

	/** Native focus targets in DOM order. */
	get items(): readonly HTMLElement[] {
		return Object.freeze(this.#collection.entries.map((entry) => entry.element));
	}

	/** The current roving-focus target. */
	get activeItem(): HTMLElement | null {
		return this.#collection.activeElement;
	}

	/** The axis used by the menubar. Defaults to horizontal. */
	get orientation(): "horizontal" | "vertical" {
		return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";
	}

	set orientation(value: "horizontal" | "vertical") {
		this.setAttribute("orientation", value === "vertical" ? "vertical" : "horizontal");
	}

	/** Whether focus wraps at either edge. Defaults to true. */
	get loopFocus(): boolean {
		return this.getAttribute("loop-focus") !== "false";
	}

	set loopFocus(value: boolean) {
		this.setAttribute("loop-focus", String(Boolean(value)));
	}

	/** The direct child menu currently open, if any. */
	get openMenu(): HTMLElement | null {
		return directMenuChildren(this).find((menu) => menu.open)?.element ?? null;
	}

	/** Focuses one current menubar item without activating it. */
	focusItem(target: MenubarTarget, options?: FocusOptions): boolean {
		const item = this.#resolveTarget(target);
		return item ? this.#collection.focus(item, options) : false;
	}

	/** Closes every currently open direct child menu. */
	close(): void {
		for (const menu of directMenuChildren(this)) {
			if (menu.open) {
				menu.closeFromParent();
			}
		}
	}

	attributeChangedCallback(): void {
		this.#synchronizeRole();
		this.#refresh();
	}

	protected override connect(connection: AUIElement.Connection): void {
		this.#refresh();
		this.addEventListener("click", this.#onClick, { capture: true, signal: connection.signal });
		this.addEventListener("focusin", this.#onFocusIn, { signal: connection.signal });
		this.addEventListener("keydown", this.#onTopLevelKeyDown, { capture: true, signal: connection.signal });
		this.addEventListener("keydown", this.#onPopupKeyDown, { signal: connection.signal });
		this.addEventListener("aui-menuchange", this.#refreshFromEvent, { signal: connection.signal });
		this.addEventListener("pointerover", this.#onPointerOver, { signal: connection.signal });

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
			],
			attributes: true,
			childList: true,
			subtree: true,
		});
		connection.addCleanup(() => {
			observer.disconnect();
			this.#collection.release();
			for (const trigger of this.#controlledTriggers) {
				this.#owner.releaseAttribute(trigger, "role");
			}
			this.#controlledTriggers.clear();
		});
	}

	#onClick = (event: MouseEvent): void => {
		const item = pathElement(event, this.items);
		if (item?.getAttribute("aria-disabled") === "true") {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	};

	#onFocusIn = (event: FocusEvent): void => {
		if (isHTMLElement(event.target) && this.#collection.contains(event.target)) {
			this.#collection.setActive(event.target);
		}
	};

	#onTopLevelKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		const item = pathElement(event, this.items);
		if (!item) {
			return;
		}
		const beforeOpen = directMenuChildren(this).some((menu) => menu.open);
		const movement = this.#collection.move(item, event.key, this.orientation, this.loopFocus);
		if (movement) {
			event.preventDefault();
			if (beforeOpen && movement.moved) {
				this.#menuForTrigger(movement.moved)?.openFromParent("none");
			}
			return;
		}
		if (this.orientation === "vertical") {
			const rtl = this.ownerDocument.defaultView?.getComputedStyle(this).direction === "rtl";
			const openKey = rtl ? "ArrowLeft" : "ArrowRight";
			if (event.key === openKey && this.#menuForTrigger(item)?.openFromParent("first")) {
				event.preventDefault();
				return;
			}
		}
		if (this.#collection.typeahead(event, item)) {
			event.preventDefault();
		}
	};

	#onPopupKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		const eventTarget = isHTMLElement(event.target) ? event.target : undefined;
		const popupMenu = directMenuChildren(this).find((menu) => eventTarget && menu.popup?.contains(eventTarget));
		const item = popupMenu?.trigger;
		if (!item) {
			return;
		}
		if (this.orientation === "vertical") {
			const rtl = this.ownerDocument.defaultView?.getComputedStyle(this).direction === "rtl";
			const closeKey = rtl ? "ArrowRight" : "ArrowLeft";
			if (event.key === closeKey) {
				event.preventDefault();
				popupMenu.closeFromParent();
				item.focus();
				return;
			}
		}
		const movement = this.#collection.move(item, event.key, this.orientation, this.loopFocus);
		if (movement) {
			event.preventDefault();
			if (movement.moved) {
				this.#menuForTrigger(movement.moved)?.openFromParent("none");
			}
		}
	};

	#onPointerOver = (event: PointerEvent): void => {
		if (event.pointerType === "touch" || !directMenuChildren(this).some((menu) => menu.open)) {
			return;
		}
		const item = pathElement(event, this.items);
		const menu = item ? this.#menuForTrigger(item) : undefined;
		if (!item || !menu || menu.open) {
			return;
		}
		if (isNativelyDisabled(item) || item.getAttribute("aria-disabled") === "true") {
			return;
		}
		this.#collection.focus(item);
		menu.openFromParent("none");
	};

	#refreshFromEvent = (): void => this.#refresh();

	#menuForTrigger(trigger: HTMLElement): MenuHandle | undefined {
		return directMenuChildren(this).find((menu) => menu.trigger === trigger);
	}

	#resolveEntries(): readonly CompositeEntry[] {
		const menus = new Map(directMenuChildren(this).map((menu) => [menu.element, menu]));
		const entries: CompositeEntry[] = [];
		for (const child of this.children) {
			const menu = menus.get(child as HTMLElement);
			if (menu?.trigger) {
				entries.push({
					disabled: isNativelyDisabled(menu.trigger),
					element: menu.trigger,
					text: this.#text(menu.trigger),
				});
				continue;
			}
			if (
				isHTMLElement(child) &&
				child.getAttribute("role") === "menuitem" &&
				(child.localName === "button" || (child.localName === "a" && child.hasAttribute("href")))
			) {
				entries.push({ disabled: isNativelyDisabled(child), element: child, text: this.#text(child) });
			}
		}
		return entries;
	}

	#refresh(): void {
		const triggers = new Set<HTMLElement>(
			directMenuChildren(this)
				.map((menu) => menu.trigger)
				.filter((trigger): trigger is HTMLButtonElement => trigger !== null),
		);
		for (const trigger of this.#controlledTriggers) {
			if (!triggers.has(trigger)) {
				this.#owner.releaseAttribute(trigger, "role");
			}
		}
		for (const trigger of triggers) {
			this.#owner.own(trigger, "role", "menuitem");
		}
		this.#controlledTriggers = triggers;
		this.#collection.refresh();
		if (this.orientation === "horizontal") {
			this.#internals.states.add("horizontal");
			this.#internals.states.delete("vertical");
		} else {
			this.#internals.states.add("vertical");
			this.#internals.states.delete("horizontal");
		}
	}

	#resolveTarget(target: MenubarTarget): HTMLElement | undefined {
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
		const label = element.getAttribute("aria-label");
		return label?.trim() ? label : (element.textContent ?? "");
	}

	#synchronizeRole(): void {
		this.#internals.ariaOrientation = this.orientation;
	}

	#upgradeProperty(name: string): void {
		if (!Object.hasOwn(this, name)) {
			return;
		}
		const value = (this as unknown as Record<string, unknown>)[name];
		delete (this as unknown as Record<string, unknown>)[name];
		(this as unknown as Record<string, unknown>)[name] = value;
	}
}
