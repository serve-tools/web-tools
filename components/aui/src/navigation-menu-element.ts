import type { RealmTimeout } from "./.composite.js";
import { clearRealmTimeout, isCompositeUnavailable, isHTMLElement, setRealmTimeout } from "./.composite.js";
import { AttributeOwner } from "./.ownership.js";
import { upgradeProperty } from "./.upgrade.js";
import { AUIElement } from "./aui-element.js";

/** A navigation item addressed by DOM order, ID, or element identity. */
export type NavigationMenuTarget = number | string | HTMLElement;

const navigationMenus = new WeakSet<HTMLElement>();

const nearestNavigationMenu = (node: Element): HTMLElement | undefined => {
	for (let current = node.parentElement; current; current = current.parentElement) {
		if (navigationMenus.has(current)) {
			return current;
		}
	}
	return undefined;
};

const isButton = (element: Element): element is HTMLButtonElement =>
	element.namespaceURI === "http://www.w3.org/1999/xhtml" && element.localName === "button";

const hasPopoverAncestorBefore = (element: Element, boundary: Element): boolean => {
	for (let current = element.parentElement; current && current !== boundary; current = current.parentElement) {
		if (current.hasAttribute("popover")) {
			return true;
		}
	}
	return false;
};

/** Coordinates ordinary site links and native popover disclosure buttons. */
export class NavigationMenuElement extends AUIElement {
	static readonly observedAttributes = ["close-delay", "delay", "orientation"];

	#closeTimer: RealmTimeout | undefined;
	#controlledTriggers = new Map<HTMLButtonElement, HTMLElement>();
	readonly #internals = this.attachInternals();
	#initialized = false;
	#list: HTMLElement | undefined;
	#openTimer: RealmTimeout | undefined;
	readonly #owner = new AttributeOwner();

	constructor() {
		super();
		navigationMenus.add(this);
		this.#internals.role = "navigation";
		for (const property of ["closeDelay", "delay", "orientation"] as const) {
			upgradeProperty(this, property);
		}
		this.#synchronizeState();
	}

	/** The direct authored list carrying `slot="list"`. */
	get list(): HTMLElement | null {
		this.#refresh();
		return this.#list ?? null;
	}

	/** Top-level ordinary links and disclosure buttons in list-row order. */
	get items(): readonly HTMLElement[] {
		this.#refresh();
		const list = this.#list;
		if (!list) {
			return [];
		}
		const items: HTMLElement[] = [];
		for (const row of list.children) {
			const item = [...row.querySelectorAll<HTMLElement>("a[href], button")].find(
				(candidate) => nearestNavigationMenu(candidate) === this && !hasPopoverAncestorBefore(candidate, this),
			);
			if (item) {
				items.push(item);
			}
		}
		return Object.freeze(items);
	}

	/** Every current descendant button whose native target is an owned popover. */
	get disclosureTriggers(): readonly HTMLButtonElement[] {
		this.#refresh();
		return Object.freeze(this.#resolveDisclosureTriggers());
	}

	/** The trigger for the deepest currently open descendant popup. */
	get openTrigger(): HTMLButtonElement | null {
		return (
			this.disclosureTriggers.filter((trigger) => this.#popupFor(trigger)?.matches(":popover-open")).at(-1) ??
			null
		);
	}

	/** The visual top-level axis. Defaults to horizontal. */
	get orientation(): "horizontal" | "vertical" {
		return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";
	}

	set orientation(value: "horizontal" | "vertical") {
		this.setAttribute("orientation", value === "vertical" ? "vertical" : "horizontal");
	}

	/** Hover-open delay in milliseconds. Defaults to 50. */
	get delay(): number {
		return this.#duration("delay", 50);
	}

	set delay(value: number) {
		this.#setDuration("delay", value);
	}

	/** Hover-close delay in milliseconds. Defaults to 50. */
	get closeDelay(): number {
		return this.#duration("close-delay", 50);
	}

	set closeDelay(value: number) {
		this.#setDuration("close-delay", value);
	}

	/** Shows the auto popover natively targeted by a current disclosure button. */
	show(trigger: HTMLButtonElement): boolean {
		this.#refresh();
		const popup = this.#popupFor(trigger);
		if (
			!popup ||
			!this.disclosureTriggers.includes(trigger) ||
			isCompositeUnavailable(trigger, this) ||
			trigger.ariaDisabled === "true"
		) {
			return false;
		}
		popup.showPopover({ source: trigger });
		return popup.matches(":popover-open");
	}

	/** Hides every open descendant popover from the deepest branch upward. */
	hide(): void {
		this.#clearTimers();
		const popups = this.disclosureTriggers
			.map((trigger) => this.#popupFor(trigger))
			.filter((popup): popup is HTMLElement => Boolean(popup?.matches(":popover-open")));
		for (const popup of popups.reverse()) {
			if (popup.matches(":popover-open")) {
				popup.hidePopover();
			}
		}
	}

	/** Focuses a top-level navigation control without changing native Tab order. */
	focusItem(target: NavigationMenuTarget, options?: FocusOptions): boolean {
		const item = this.#resolveTarget(target);
		if (!item || isCompositeUnavailable(item, this)) {
			return false;
		}
		item.focus(options);
		return this.ownerDocument.activeElement === item;
	}

	attributeChangedCallback(): void {
		this.#refresh();
		this.#synchronizeState();
	}

	protected override connect(connection: AUIElement.Connection): void {
		this.#refresh();
		this.addEventListener("click", this.#onClick, { capture: true, signal: connection.signal });
		this.addEventListener("toggle", this.#onToggle, { capture: true, signal: connection.signal });
		this.addEventListener("focusout", this.#onFocusOut, { signal: connection.signal });
		this.addEventListener("keydown", this.#onKeyDown, { signal: connection.signal });
		this.addEventListener("pointerover", this.#onPointerOver, { signal: connection.signal });
		this.addEventListener("pointerout", this.#onPointerOut, { signal: connection.signal });

		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: [
				"aria-disabled",
				"disabled",
				"hidden",
				"href",
				"id",
				"inert",
				"popover",
				"popovertarget",
				"slot",
				"type",
			],
			attributes: true,
			childList: true,
			subtree: true,
		});
		connection.addCleanup(() => {
			observer.disconnect();
			this.#clearTimers();
			for (const trigger of this.#controlledTriggers.keys()) {
				this.#owner.release(trigger);
			}
			this.#controlledTriggers.clear();
		});
	}

	#onClick = (event: MouseEvent): void => {
		const trigger = this.disclosureTriggers.find((candidate) => event.composedPath().includes(candidate));
		if (trigger?.getAttribute("aria-disabled") === "true") {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	};

	#onToggle = (event: ToggleEvent): void => {
		if (!this.#isOwnedPopup(event.target)) {
			return;
		}
		this.#synchronizeExpanded();
		if (this.openTrigger) {
			this.#internals.states.add("open");
		} else {
			this.#internals.states.delete("open");
		}
	};

	#onFocusOut = (): void => {
		queueMicrotask(() => {
			const active = this.ownerDocument.activeElement;
			if (active && this.contains(active)) {
				return;
			}
			this.hide();
		});
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		const items = this.items;
		const current = items.find((item) => event.composedPath().includes(item));
		if (!current) {
			return;
		}
		const enabled = items.filter((item) => !isCompositeUnavailable(item, this));
		const index = enabled.indexOf(current);
		if (index < 0) {
			return;
		}
		const rtl = this.ownerDocument.defaultView?.getComputedStyle(this).direction === "rtl";
		const forward = this.orientation === "vertical" ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
		const backward = this.orientation === "vertical" ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
		if (event.key === forward || event.key === backward || event.key === "Home" || event.key === "End") {
			const next =
				event.key === "Home"
					? 0
					: event.key === "End"
						? enabled.length - 1
						: index + (event.key === forward ? 1 : -1);
			const target = enabled[next];
			if (target && this.focusItem(target)) {
				event.preventDefault();
			}
			return;
		}
		const openKey = this.orientation === "horizontal" ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
		if (event.key === openKey && isButton(current) && this.show(current)) {
			event.preventDefault();
		}
	};

	#onPointerOver = (event: PointerEvent): void => {
		if (event.pointerType === "touch") {
			return;
		}
		const trigger = this.disclosureTriggers.find((candidate) => event.composedPath().includes(candidate));
		if (trigger) {
			this.#cancelOpen();
			this.#cancelClose();
			if (!this.#popupFor(trigger)?.matches(":popover-open")) {
				this.#scheduleOpen(trigger);
			}
			return;
		}
		if (isHTMLElement(event.target) && this.#isOwnedPopup(event.target.closest("[popover]"))) {
			this.#cancelOpen();
			this.#cancelClose();
		}
	};

	#onPointerOut = (event: PointerEvent): void => {
		if (event.pointerType === "touch") {
			return;
		}
		const related = isHTMLElement(event.relatedTarget) ? event.relatedTarget : null;
		if (related && this.contains(related)) {
			const relatedPopup = related.closest("[popover]");
			if (relatedPopup || this.disclosureTriggers.some((trigger) => trigger.contains(related))) {
				return;
			}
		}
		const target = isHTMLElement(event.target) ? event.target : null;
		const trigger = target
			? this.disclosureTriggers.find((candidate) => candidate === target || candidate.contains(target))
			: undefined;
		const popup = target?.closest<HTMLElement>("[popover]") ?? null;
		if (trigger || this.#isOwnedPopup(popup)) {
			this.#cancelOpen();
			this.#scheduleClose();
		}
	};

	#scheduleOpen(trigger: HTMLButtonElement): void {
		this.#cancelOpen();
		const popup = this.#popupFor(trigger);
		this.#openTimer = setRealmTimeout(
			this,
			() => {
				this.#openTimer = undefined;
				if (this.isConnected && popup === this.#popupFor(trigger)) {
					this.show(trigger);
				}
			},
			this.delay,
		);
	}

	#scheduleClose(): void {
		this.#cancelClose();
		this.#closeTimer = setRealmTimeout(
			this,
			() => {
				this.#closeTimer = undefined;
				this.hide();
			},
			this.closeDelay,
		);
	}

	#cancelOpen(): void {
		clearRealmTimeout(this.#openTimer);
		this.#openTimer = undefined;
	}

	#cancelClose(): void {
		clearRealmTimeout(this.#closeTimer);
		this.#closeTimer = undefined;
	}

	#clearTimers(): void {
		this.#cancelOpen();
		this.#cancelClose();
	}

	#refresh(): void {
		this.#list = [...this.children].find(
			(child): child is HTMLElement => isHTMLElement(child) && child.getAttribute("slot") === "list",
		);
		const triggers = new Map(
			this.#resolveDisclosureTriggers().map((trigger) => [trigger, this.#popupFor(trigger)] as const),
		);
		const changed =
			this.#initialized &&
			(this.#controlledTriggers.size !== triggers.size ||
				[...this.#controlledTriggers].some(([trigger, popup]) => triggers.get(trigger) !== popup));
		if (changed) {
			this.#clearTimers();
		}
		for (const [trigger, popup] of this.#controlledTriggers) {
			if (triggers.get(trigger) !== popup) {
				if (popup.matches(":popover-open")) {
					popup.hidePopover();
				}
				this.#owner.release(trigger);
			}
		}
		for (const [trigger, popup] of triggers) {
			this.#owner.own(trigger, "type", "button");
			this.#owner.own(trigger, "aria-expanded", String(popup?.matches(":popover-open") ?? false));
		}
		this.#controlledTriggers = new Map(
			[...triggers].filter((entry): entry is [HTMLButtonElement, HTMLElement] => entry[1] !== undefined),
		);
		if ([...this.#controlledTriggers.values()].some((popup) => popup.matches(":popover-open"))) {
			this.#internals.states.add("open");
		} else {
			this.#internals.states.delete("open");
		}
		this.#initialized = true;
		this.#synchronizeState();
	}

	#resolveDisclosureTriggers(): HTMLButtonElement[] {
		return [...this.querySelectorAll("button[popovertarget]")].filter(
			(trigger): trigger is HTMLButtonElement =>
				isButton(trigger) && nearestNavigationMenu(trigger) === this && this.#popupFor(trigger) !== undefined,
		);
	}

	#popupFor(trigger: HTMLButtonElement): HTMLElement | undefined {
		const nativeTarget = trigger.popoverTargetElement;
		if (
			isHTMLElement(nativeTarget) &&
			this.contains(nativeTarget) &&
			nativeTarget.popover === "auto" &&
			nearestNavigationMenu(nativeTarget) === this
		) {
			return nativeTarget;
		}
		const id = trigger.getAttribute("popovertarget");
		if (!id) {
			return;
		}
		const popup = this.ownerDocument.getElementById(id);
		return isHTMLElement(popup) &&
			this.contains(popup) &&
			popup.popover === "auto" &&
			nearestNavigationMenu(popup) === this
			? popup
			: undefined;
	}

	#isOwnedPopup(value: unknown): value is HTMLElement {
		return isHTMLElement(value) && this.disclosureTriggers.some((trigger) => this.#popupFor(trigger) === value);
	}

	#synchronizeExpanded(): void {
		for (const trigger of this.disclosureTriggers) {
			this.#owner.own(
				trigger,
				"aria-expanded",
				String(this.#popupFor(trigger)?.matches(":popover-open") ?? false),
			);
		}
	}

	#resolveTarget(target: NavigationMenuTarget): HTMLElement | undefined {
		const items = this.items;
		if (typeof target === "number") {
			return items[target];
		}
		if (typeof target === "string") {
			return items.find((item) => item.id === target);
		}
		return items.includes(target) ? target : undefined;
	}

	#synchronizeState(): void {
		if (this.orientation === "horizontal") {
			this.#internals.states.add("horizontal");
			this.#internals.states.delete("vertical");
		} else {
			this.#internals.states.add("vertical");
			this.#internals.states.delete("horizontal");
		}
	}

	#duration(name: string, fallback: number): number {
		const number = Number(this.getAttribute(name));
		return this.hasAttribute(name) && Number.isFinite(number) && number >= 0 ? number : fallback;
	}

	#setDuration(name: string, value: number): void {
		const number = Number(value);
		if (!Number.isFinite(number) || number < 0) {
			throw new TypeError(`${name} must be a finite nonnegative number`);
		}
		this.setAttribute(name, String(number));
	}
}
