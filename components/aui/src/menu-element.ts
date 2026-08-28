import type { CompositeEntry, RealmTimeout } from "./.composite.js";
import {
	CompositeCollection,
	clearRealmTimeout,
	isHTMLElement,
	isNativelyDisabled,
	pathElement,
	setRealmTimeout,
} from "./.composite.js";
import type { MenuHandle } from "./.menu.js";
import { getContainingMenu, getMenuByTrigger, notifyMenuChange, registerMenu, updateMenuTrigger } from "./.menu.js";
import { AttributeOwner, NativePopoverElement } from "./.popover.js";
import type { AUIElement } from "./aui-element.js";

/** A menu item addressed by DOM order, ID, or native element identity. */
export type MenuTarget = number | string | HTMLElement;

/** Immutable checked-state proposal emitted by a menu. */
export interface MenuChangeDetail {
	readonly checked: boolean;
	readonly item: HTMLButtonElement;
	readonly sourceEvent: MouseEvent;
}

/** Events emitted by a menu in addition to forwarded native toggle events. */
export interface MenuEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<MenuChangeDetail>;
	beforetoggle: ToggleEvent;
	toggle: ToggleEvent;
}

const itemSelector =
	"button[role='menuitem'], a[href][role='menuitem'], button[role='menuitemcheckbox'], button[role='menuitemradio']";
const checkedRoles = new Set(["menuitemcheckbox", "menuitemradio"]);
let generatedId = 0;

const isButton = (element: Element): element is HTMLButtonElement =>
	element.namespaceURI === "http://www.w3.org/1999/xhtml" && element.localName === "button";

const itemText = (element: HTMLElement): string => {
	const label = element.getAttribute("aria-label");
	return label?.trim() ? label : (element.textContent ?? "");
};

/** Coordinates an author-owned native menu popup and native role-bearing items. */
export class MenuElement extends NativePopoverElement {
	static readonly observedAttributes = ["close-delay", "delay", "loop-focus", "open-on-hover", "orientation"];

	#changing = false;
	#closeTimer: RealmTimeout | undefined;
	readonly #collection = new CompositeCollection(this, () => this.#resolveEntries());
	#controlledItems = new Set<HTMLElement>();
	#graceController: AbortController | undefined;
	#initialized = false;
	readonly #internals = this.attachInternals();
	readonly #menuHandle: MenuHandle;
	#openTimer: RealmTimeout | undefined;
	readonly #owner = new AttributeOwner();
	#pendingEdge: "first" | "last" | "none" | undefined;
	#popup: HTMLElement | undefined;
	#refreshing = false;
	#revision = 0;
	#trigger: HTMLButtonElement | undefined;

	declare addEventListener: {
		<Type extends keyof MenuEventMap>(
			type: Type,
			listener: (this: MenuElement, event: MenuEventMap[Type]) => unknown,
			options?: boolean | AddEventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | AddEventListenerOptions,
		): void;
	};

	declare removeEventListener: {
		<Type extends keyof MenuEventMap>(
			type: Type,
			listener: (this: MenuElement, event: MenuEventMap[Type]) => unknown,
			options?: boolean | EventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | EventListenerOptions,
		): void;
	};

	constructor() {
		super();
		const element = this;
		this.#menuHandle = {
			closeFromParent() {
				if (element.open) {
					element.hide();
				}
			},
			element: this,
			get open() {
				return element.open;
			},
			openFromParent(edge) {
				return element.#openFromParent(edge);
			},
			get popup() {
				return element.popup;
			},
			get trigger() {
				element.#refresh();
				return element.#trigger ?? null;
			},
		};
		registerMenu(this, this.#menuHandle);
		for (const property of ["closeDelay", "delay", "loopFocus", "openOnHover", "orientation"] as const) {
			this.#upgradeProperty(property);
		}
	}

	/** The direct native button used as the primary menu invoker. */
	get trigger(): HTMLElement | null {
		this.#refresh();
		return this.#trigger ?? null;
	}

	/** A frozen DOM-order snapshot of the current popup's native menu items. */
	get items(): readonly HTMLElement[] {
		this.#refresh();
		return Object.freeze(this.#collection.entries.map((entry) => entry.element));
	}

	/** The current roving-focus item. */
	get activeItem(): HTMLElement | null {
		this.#refresh();
		return this.#collection.activeElement;
	}

	/** The axis used by menu item arrow navigation. */
	get orientation(): "horizontal" | "vertical" {
		return this.getAttribute("orientation") === "horizontal" ? "horizontal" : "vertical";
	}

	set orientation(value: "horizontal" | "vertical") {
		this.setAttribute("orientation", value === "horizontal" ? "horizontal" : "vertical");
	}

	/** Whether arrow navigation wraps. Defaults to true. */
	get loopFocus(): boolean {
		return this.getAttribute("loop-focus") !== "false";
	}

	set loopFocus(value: boolean) {
		this.setAttribute("loop-focus", String(Boolean(value)));
	}

	/** Whether mouse and pen hover may open the primary trigger. */
	get openOnHover(): boolean {
		return this.hasAttribute("open-on-hover");
	}

	set openOnHover(value: boolean) {
		this.toggleAttribute("open-on-hover", Boolean(value));
	}

	/** Hover-open delay in milliseconds. Defaults to 100. */
	get delay(): number {
		return this.#duration("delay", 100);
	}

	set delay(value: number) {
		this.#setDuration("delay", value);
	}

	/** Hover-close delay in milliseconds. Defaults to 0. */
	get closeDelay(): number {
		return this.#duration("close-delay", 0);
	}

	set closeDelay(value: number) {
		this.#setDuration("close-delay", value);
	}

	override show(source?: HTMLElement): void {
		this.#refresh();
		this.#pendingEdge = "first";
		super.show(source ?? this.#trigger);
	}

	override hide(): void {
		this.#clearHover();
		super.hide();
	}

	override toggle(source?: HTMLElement): boolean {
		this.#refresh();
		if (!this.open) {
			this.#pendingEdge = "first";
		}
		return super.toggle(source ?? this.#trigger);
	}

	/** Focuses an enabled menu item without activating it. */
	focusItem(target: MenuTarget, options?: FocusOptions): boolean {
		const item = this.#resolveTarget(target);
		return item ? this.#collection.focus(item, options) : false;
	}

	/** Silently sets a checkable item's ARIA state while maintaining radio exclusivity. */
	setChecked(item: HTMLButtonElement, checked: boolean): void {
		this.#refresh();
		if (!this.#isCurrentItem(item) || !checkedRoles.has(item.getAttribute("role") ?? "")) {
			throw new TypeError("Menu checked state requires a current checkbox or radio menu item");
		}
		this.#commitChecked(item, Boolean(checked));
	}

	attributeChangedCallback(): void {
		++this.#revision;
		this.#refresh();
	}

	protected override connect(connection: AUIElement.Connection): void {
		super.connect(connection);
		this.#refresh();
		notifyMenuChange(this.#menuHandle);
		this.addEventListener("click", this.#onClick, { signal: connection.signal });
		this.addEventListener("focusin", this.#onFocusIn, { signal: connection.signal });
		this.addEventListener("focusout", this.#onFocusOut, { signal: connection.signal });
		this.addEventListener("keydown", this.#onKeyDown, { signal: connection.signal });
		this.addEventListener("pointerdown", this.#onPointerDown, { signal: connection.signal });
		this.addEventListener("pointerover", this.#onPointerOver, { signal: connection.signal });
		this.addEventListener("pointerout", this.#onPointerOut, { signal: connection.signal });

		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => {
			++this.#revision;
			this.#refresh();
		});
		observer.observe(this, {
			attributeFilter: [
				"aria-checked",
				"aria-disabled",
				"aria-label",
				"data-close-on-click",
				"disabled",
				"href",
				"hidden",
				"id",
				"inert",
				"popover",
				"role",
				"slot",
				"tabindex",
				"type",
			],
			attributes: true,
			characterData: true,
			childList: true,
			subtree: true,
		});
		connection.addCleanup(() => {
			observer.disconnect();
			this.#clearHover();
			this.#collection.release();
			this.#releaseOwned();
		});
	}

	protected override beforeToggled(event: ToggleEvent): void {
		++this.#revision;
		this.#refresh();
		if (event.newState === "open") {
			this.#pendingEdge ??= "first";
		}
		const popup = this.#popup;
		queueMicrotask(() => {
			if (popup !== this.#popup) {
				return;
			}
			const open = popup?.matches(":popover-open") ?? false;
			this.#synchronizeExpanded(open);
			if (!open && event.newState === "open") {
				this.#pendingEdge = undefined;
			}
		});
	}

	protected override toggled(event: ToggleEvent): void {
		this.#synchronizeExpanded(event.newState === "open");
		this.#setState("open", event.newState === "open");
		if (event.newState !== "open") {
			this.#pendingEdge = undefined;
			this.#collection.clearTypeahead();
			this.#clearHover();
			return;
		}

		const edge = this.#pendingEdge;
		this.#pendingEdge = undefined;
		if (edge === "none") {
			return;
		}
		const popup = this.#popup;
		const revision = this.#revision;
		queueMicrotask(() => {
			if (!this.isConnected || this.#popup !== popup || this.#revision !== revision || !this.open) {
				return;
			}
			const items = edge === "last" ? [...this.items].reverse() : this.items;
			for (const item of items) {
				if (this.#collection.focus(item)) {
					break;
				}
			}
		});
	}

	#onFocusIn = (event: FocusEvent): void => {
		if (isHTMLElement(event.target) && this.#collection.contains(event.target)) {
			this.#collection.setActive(event.target);
		}
	};

	#onFocusOut = (): void => {
		const popup = this.#popup;
		queueMicrotask(() => {
			const active = this.ownerDocument.activeElement;
			if (this.#popup !== popup || !this.open || (active && this.contains(active))) {
				return;
			}
			this.hide();
		});
	};

	#onClick = (sourceEvent: MouseEvent): void => {
		if (sourceEvent.defaultPrevented || this.#changing) {
			return;
		}
		this.#refresh();
		const item = pathElement(sourceEvent, this.items);
		if (!item) {
			if (this.#trigger && sourceEvent.composedPath().includes(this.#trigger)) {
				if (isNativelyDisabled(this.#trigger) || this.#trigger.getAttribute("aria-disabled") === "true") {
					sourceEvent.preventDefault();
					return;
				}
				this.#pendingEdge = "first";
			}
			return;
		}
		if (item.getAttribute("aria-disabled") === "true" || isNativelyDisabled(item)) {
			sourceEvent.preventDefault();
			return;
		}
		if (getMenuByTrigger(item)) {
			return;
		}

		const role = item.getAttribute("role") ?? "";
		const close = this.#closeOnClick(item, !checkedRoles.has(role));
		if (checkedRoles.has(role) && isButton(item)) {
			const checked = role === "menuitemradio" ? true : item.getAttribute("aria-checked") !== "true";
			if (role !== "menuitemradio" || item.getAttribute("aria-checked") !== "true") {
				if (!this.#proposeChecked(item, checked, sourceEvent)) {
					return;
				}
			}
		}
		if (close && this.open) {
			this.hide();
		}
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		this.#refresh();
		if (
			this.#trigger &&
			event.composedPath().includes(this.#trigger) &&
			!this.#popup?.contains(event.target as Node)
		) {
			if (!this.#popup) {
				return;
			}
			if (isNativelyDisabled(this.#trigger) || this.#trigger.getAttribute("aria-disabled") === "true") {
				if (
					event.key === "ArrowDown" ||
					event.key === "ArrowUp" ||
					event.key === "Enter" ||
					event.key === " "
				) {
					event.preventDefault();
				}
				return;
			}
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				this.#pendingEdge = event.key === "ArrowUp" ? "last" : "first";
				if (!this.open) {
					super.show(this.#trigger);
				} else {
					this.#focusEdge(event.key === "ArrowUp" ? "last" : "first");
				}
			} else if (event.key === "Enter" || event.key === " ") {
				this.#pendingEdge = "first";
			}
			return;
		}

		const item = pathElement(event, this.items);
		if (!item) {
			return;
		}
		if (item.getAttribute("aria-disabled") === "true" && (event.key === "Enter" || event.key === " ")) {
			event.preventDefault();
			return;
		}
		if (event.key === " " && item.localName === "a") {
			event.preventDefault();
			(item as HTMLAnchorElement).click();
			return;
		}
		const direction = this.ownerDocument.defaultView?.getComputedStyle(this).direction === "rtl";
		const inlineEnd = direction ? "ArrowLeft" : "ArrowRight";
		const inlineStart = direction ? "ArrowRight" : "ArrowLeft";
		const submenu = getMenuByTrigger(item);
		const submenuOpenKey = this.orientation === "vertical" ? inlineEnd : "ArrowDown";
		const parentCloseKey = this.orientation === "vertical" ? inlineStart : "ArrowUp";
		if (submenu && event.key === submenuOpenKey) {
			if (submenu.openFromParent("first")) {
				event.preventDefault();
			}
			return;
		}
		if (event.key === parentCloseKey) {
			const parent = getContainingMenu(this, this.#menuHandle);
			if (parent) {
				event.preventDefault();
				this.hide();
				this.#trigger?.focus();
				return;
			}
		}
		if (event.key === "Tab") {
			if (this.open) {
				this.hide();
			}
			return;
		}
		const movement = this.#collection.move(item, event.key, this.orientation, this.loopFocus);
		if (movement) {
			event.preventDefault();
			return;
		}
		if (this.#collection.typeahead(event, item)) {
			event.preventDefault();
		}
	};

	#onPointerDown = (event: PointerEvent): void => {
		if (event.defaultPrevented || event.pointerType === "touch") {
			return;
		}
		const item = pathElement(event, this.items);
		if (!item) {
			return;
		}
		if (isNativelyDisabled(item) || item.getAttribute("aria-disabled") === "true") {
			event.preventDefault();
			return;
		}
		this.#collection.focus(item, { preventScroll: true });
	};

	#onPointerOver = (event: PointerEvent): void => {
		if (event.pointerType === "touch") {
			return;
		}
		this.#refresh();
		const target = event.target;
		if (!isHTMLElement(target)) {
			return;
		}
		if (target === this.#trigger || this.#trigger?.contains(target) || this.#popup?.contains(target)) {
			this.#cancelClose();
			if (
				this.openOnHover &&
				this.#trigger &&
				(target === this.#trigger || this.#trigger.contains(target)) &&
				!this.open &&
				!this.#triggerUnavailable()
			) {
				this.#scheduleOpen();
			}
		}
	};

	#onPointerOut = (event: PointerEvent): void => {
		if (event.pointerType === "touch") {
			return;
		}
		const related = event.relatedTarget;
		if (isHTMLElement(related) && (this.#trigger?.contains(related) || this.#popup?.contains(related))) {
			return;
		}
		const target = event.target;
		if (!isHTMLElement(target)) {
			return;
		}
		if (this.#trigger?.contains(target) && this.open) {
			this.#startGrace(event);
		} else if (this.#popup?.contains(target)) {
			this.#scheduleClose(this.closeDelay);
		} else if (this.#trigger?.contains(target)) {
			this.#cancelOpen();
		}
	};

	#scheduleOpen(): void {
		this.#cancelOpen();
		const popup = this.#popup;
		const trigger = this.#trigger;
		const revision = this.#revision;
		this.#openTimer = setRealmTimeout(
			this,
			() => {
				this.#openTimer = undefined;
				if (
					!this.isConnected ||
					popup !== this.#popup ||
					trigger !== this.#trigger ||
					revision !== this.#revision ||
					!popup ||
					!trigger ||
					this.#triggerUnavailable(trigger)
				) {
					return;
				}
				this.#pendingEdge = "none";
				super.show(trigger);
			},
			this.delay,
		);
	}

	#scheduleClose(delay: number): void {
		this.#cancelClose();
		const popup = this.#popup;
		this.#closeTimer = setRealmTimeout(
			this,
			() => {
				this.#closeTimer = undefined;
				if (popup === this.#popup && this.open) {
					this.hide();
				}
			},
			delay,
		);
	}

	#startGrace(event: PointerEvent): void {
		this.#cancelClose();
		const popup = this.#popup;
		if (!popup) {
			return;
		}
		const rect = popup.getBoundingClientRect();
		const start = { x: event.clientX, y: event.clientY };
		const horizontal = Math.abs(start.x - rect.left) < Math.abs(start.x - rect.right);
		const edgeX = horizontal ? rect.left - 8 : rect.right + 8;
		const points = [start, { x: edgeX, y: rect.top - 8 }, { x: edgeX, y: rect.bottom + 8 }] as const;
		const Controller = this.ownerDocument.defaultView?.AbortController ?? AbortController;
		const controller = new Controller();
		this.#graceController?.abort();
		this.#graceController = controller;
		this.ownerDocument.addEventListener(
			"pointermove",
			(move) => {
				if (popup.contains(move.target as Node) || this.#trigger?.contains(move.target as Node)) {
					this.#cancelClose();
					return;
				}
				if (!this.#insideTriangle(move.clientX, move.clientY, points)) {
					controller.abort();
					if (this.#graceController === controller) {
						this.#graceController = undefined;
					}
					this.#scheduleClose(this.closeDelay);
				}
			},
			{ capture: true, signal: controller.signal },
		);
		this.#closeTimer = setRealmTimeout(
			this,
			() => {
				if (this.#graceController === controller) {
					this.#graceController = undefined;
				}
				controller.abort();
				this.#closeTimer = undefined;
				if (popup === this.#popup && this.open) {
					this.hide();
				}
			},
			Math.max(300, this.closeDelay),
		);
	}

	#insideTriangle(x: number, y: number, points: readonly { x: number; y: number }[]): boolean {
		const [a, b, c] = points;
		if (!a || !b || !c) {
			return false;
		}
		const sign = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) =>
			(p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
		const point = { x, y };
		const d1 = sign(point, a, b);
		const d2 = sign(point, b, c);
		const d3 = sign(point, c, a);
		return !(d1 < 0 || d2 < 0 || d3 < 0) || !(d1 > 0 || d2 > 0 || d3 > 0);
	}

	#cancelOpen(): void {
		clearRealmTimeout(this.#openTimer);
		this.#openTimer = undefined;
	}

	#cancelClose(): void {
		clearRealmTimeout(this.#closeTimer);
		this.#closeTimer = undefined;
		this.#graceController?.abort();
		this.#graceController = undefined;
	}

	#clearHover(): void {
		this.#cancelOpen();
		this.#cancelClose();
	}

	#proposeChecked(item: HTMLButtonElement, checked: boolean, sourceEvent: MouseEvent): boolean {
		if (this.#refreshing || this.#changing) {
			return false;
		}
		const revision = this.#revision;
		const role = item.getAttribute("role");
		const beforeItems = this.items;
		const before = this.#interactionSnapshot(beforeItems);
		const beforeRadioGroups = this.#radioGroups(beforeItems);
		const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
		const proposal = new EventConstructor<MenuChangeDetail>("beforechange", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail: Object.freeze({ checked, item, sourceEvent }),
		});
		this.#changing = true;
		try {
			if (!this.dispatchEvent(proposal)) {
				return false;
			}
			this.#refresh();
			const afterItems = this.items;
			if (
				revision !== this.#revision ||
				role !== item.getAttribute("role") ||
				!this.#isCurrentItem(item) ||
				beforeItems.length !== afterItems.length ||
				beforeItems.some((candidate, index) => candidate !== afterItems[index]) ||
				before !== this.#interactionSnapshot(afterItems) ||
				beforeRadioGroups.some((group, index) => group !== this.#radioGroup(afterItems[index]))
			) {
				return false;
			}
			this.#commitChecked(item, checked);
			const committedRevision = this.#revision;
			const committedItems = this.items;
			const committedSnapshot = this.#interactionSnapshot(committedItems);
			const committedRadioGroups = this.#radioGroups(committedItems);
			const committedPopup = this.#popup;
			const committedOpen = this.open;
			const NativeEvent = this.ownerDocument.defaultView?.Event ?? Event;
			this.dispatchEvent(new NativeEvent("input", { bubbles: true, composed: true }));
			if (
				!this.#commitStillCurrent(
					item,
					committedRevision,
					committedItems,
					committedSnapshot,
					committedRadioGroups,
					committedPopup,
					committedOpen,
				)
			) {
				return false;
			}
			this.dispatchEvent(new NativeEvent("change", { bubbles: true }));
			return this.#commitStillCurrent(
				item,
				committedRevision,
				committedItems,
				committedSnapshot,
				committedRadioGroups,
				committedPopup,
				committedOpen,
			);
		} finally {
			this.#changing = false;
		}
	}

	#commitStillCurrent(
		item: HTMLButtonElement,
		revision: number,
		items: readonly HTMLElement[],
		snapshot: string,
		radioGroups: readonly (Element | undefined)[],
		popup: HTMLElement | undefined,
		open: boolean,
	): boolean {
		this.#refresh();
		const current = this.items;
		return (
			this.#revision === revision &&
			this.#popup === popup &&
			this.open === open &&
			this.#isCurrentItem(item) &&
			items.length === current.length &&
			items.every((candidate, index) => candidate === current[index]) &&
			this.#interactionSnapshot(current) === snapshot &&
			radioGroups.every((group, index) => group === this.#radioGroup(current[index]))
		);
	}

	#commitChecked(item: HTMLButtonElement, checked: boolean): void {
		if (item.getAttribute("role") === "menuitemradio" && checked) {
			const group = item.closest("[role='group']") ?? this.#popup;
			for (const candidate of this.items) {
				if (
					candidate !== item &&
					candidate.getAttribute("role") === "menuitemradio" &&
					(candidate.closest("[role='group']") ?? this.#popup) === group
				) {
					candidate.setAttribute("aria-checked", "false");
				}
			}
		}
		item.setAttribute("aria-checked", String(checked));
		++this.#revision;
	}

	#interactionSnapshot(items: readonly HTMLElement[]): string {
		return items
			.map((candidate) =>
				[
					candidate.getAttribute("role"),
					candidate.getAttribute("aria-checked"),
					candidate.getAttribute("aria-disabled"),
					candidate.getAttribute("disabled"),
					candidate.getAttribute("data-close-on-click"),
				].join(":"),
			)
			.join("\u0000");
	}

	#radioGroups(items: readonly HTMLElement[]): readonly (Element | undefined)[] {
		return items.map((item) => this.#radioGroup(item));
	}

	#radioGroup(item: HTMLElement | undefined): Element | undefined {
		return item?.getAttribute("role") === "menuitemradio"
			? (item.closest("[role='group']") ?? this.#popup)
			: undefined;
	}

	#closeOnClick(item: HTMLElement, fallback: boolean): boolean {
		const value = item.getAttribute("data-close-on-click");
		if (value === null) {
			return fallback;
		}
		if (value === "true") {
			return true;
		}
		if (value === "false") {
			return false;
		}
		return fallback;
	}

	#resolveEntries(): readonly CompositeEntry[] {
		const popup = this.#popup;
		if (!popup) {
			return [];
		}
		const entries: CompositeEntry[] = [];
		for (const element of popup.querySelectorAll<HTMLElement>(itemSelector)) {
			if (element.closest("[role='menu']") !== popup) {
				continue;
			}
			entries.push({ disabled: isNativelyDisabled(element), element, text: itemText(element) });
		}
		return entries;
	}

	#resolveTarget(target: MenuTarget): HTMLElement | undefined {
		const items = this.items;
		if (typeof target === "number") {
			return items[target];
		}
		if (typeof target === "string") {
			return items.find((item) => item.id === target);
		}
		return items.includes(target) ? target : undefined;
	}

	#focusEdge(edge: "first" | "last", options?: FocusOptions): boolean {
		const items = edge === "last" ? [...this.items].reverse() : this.items;
		for (const item of items) {
			if (this.#collection.focus(item, options)) {
				return true;
			}
		}
		return false;
	}

	#triggerUnavailable(trigger = this.#trigger): boolean {
		return !trigger || isNativelyDisabled(trigger) || trigger.getAttribute("aria-disabled") === "true";
	}

	#isCurrentItem(item: HTMLElement): boolean {
		return this.items.includes(item);
	}

	#refresh(): void {
		if (this.#refreshing) {
			return;
		}
		this.#refreshing = true;
		try {
			const trigger = [...this.children].find(
				(child) => isButton(child) && child.getAttribute("slot") === "trigger",
			) as HTMLButtonElement | undefined;
			const popup = this.findPopup();
			const changed = trigger !== this.#trigger || popup !== this.#popup;
			if (changed && this.#initialized) {
				this.#clearHover();
				this.#collection.clearTypeahead();
				this.#pendingEdge = undefined;
			}
			if (changed && this.#initialized && this.#popup?.matches(":popover-open")) {
				this.#popup.hidePopover();
			}
			if (trigger !== this.#trigger) {
				const previous = this.#trigger;
				if (previous) {
					this.#owner.release(previous);
				}
				this.#trigger = trigger;
				updateMenuTrigger(this.#menuHandle, previous, trigger);
			}
			if (popup !== this.#popup) {
				if (this.#popup) {
					this.#owner.release(this.#popup);
				}
				this.#popup = popup;
			}

			if (popup) {
				if (popup.popover !== "auto") {
					this.#owner.own(popup, "popover", "auto");
				}
				this.#owner.own(popup, "role", "menu");
				this.#owner.own(popup, "aria-orientation", this.orientation);
				if (!popup.id) {
					this.#owner.own(popup, "id", `aui-menu-${++generatedId}`);
				}
			}
			if (trigger) {
				this.#owner.own(trigger, "type", "button");
				if (popup) {
					this.#owner.own(trigger, "aria-haspopup", "menu");
					this.#owner.own(trigger, "aria-expanded", String(popup.matches(":popover-open")));
					this.#owner.own(trigger, "aria-controls", popup.id);
				} else {
					this.#owner.releaseAttribute(trigger, "aria-haspopup");
					this.#owner.releaseAttribute(trigger, "aria-expanded");
					this.#owner.releaseAttribute(trigger, "aria-controls");
				}
			}

			const nextItems = new Set(this.#resolveEntries().map((entry) => entry.element));
			for (const item of this.#controlledItems) {
				if (!nextItems.has(item)) {
					this.#owner.releaseAttribute(item, "type");
				}
			}
			for (const item of nextItems) {
				if (isButton(item)) {
					this.#owner.own(item, "type", "button");
					if (checkedRoles.has(item.getAttribute("role") ?? "") && !item.hasAttribute("aria-checked")) {
						item.setAttribute("aria-checked", "false");
					}
				}
			}
			this.#controlledItems = nextItems;
			this.#collection.refresh();
			this.#setState("horizontal", this.orientation === "horizontal");
			this.#setState("vertical", this.orientation === "vertical");
			this.#setState("open", popup?.matches(":popover-open") ?? false);
			this.#initialized = true;
			if (changed && this.isConnected) {
				notifyMenuChange(this.#menuHandle);
			}
		} finally {
			this.#refreshing = false;
		}
	}

	#synchronizeExpanded(open: boolean): void {
		if (this.#trigger) {
			this.#owner.own(this.#trigger, "aria-expanded", String(open));
		}
	}

	#releaseOwned(): void {
		if (this.#trigger) {
			this.#owner.release(this.#trigger);
		}
		if (this.#popup) {
			this.#owner.release(this.#popup);
		}
		for (const item of this.#controlledItems) {
			this.#owner.releaseAttribute(item, "type");
		}
		this.#controlledItems.clear();
	}

	#openFromParent(edge: "first" | "last" | "none"): boolean {
		this.#refresh();
		if (!this.#popup || this.#triggerUnavailable()) {
			return false;
		}
		this.#pendingEdge = edge;
		if (!this.open) {
			super.show(this.#trigger);
		} else if (edge !== "none") {
			this.#focusEdge(edge);
			this.#pendingEdge = undefined;
		}
		return true;
	}

	#duration(name: string, fallback: number): number {
		const value = this.getAttribute(name);
		if (value === null) {
			return fallback;
		}
		const number = Number(value);
		return Number.isFinite(number) && number >= 0 ? number : fallback;
	}

	#setDuration(name: string, value: number): void {
		const number = Number(value);
		if (!Number.isFinite(number) || number < 0) {
			throw new TypeError(`${name} must be a finite nonnegative number`);
		}
		this.setAttribute(name, String(number));
	}

	#setState(state: string, present: boolean): void {
		if (present) {
			this.#internals.states.add(state);
		} else {
			this.#internals.states.delete(state);
		}
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
