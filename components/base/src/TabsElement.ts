import { BaseElement } from "./BaseElement.js";

/** The axis used for tab-list keyboard navigation. */
export type TabsOrientation = "horizontal" | "vertical";

/** Whether moving focus also selects a tab. */
export type TabsActivation = "automatic" | "manual";

/** A tab addressed by DOM index, native button value, or element identity. */
export type TabsTarget = number | string | HTMLButtonElement;

type AttributeValue = string | null;

interface OwnedAttribute {
	author: AttributeValue;
	owned: AttributeValue;
}

const interactiveContent = "button, input, select, textarea, a[href], [contenteditable]:not([contenteditable='false'])";
const htmlNamespace = "http://www.w3.org/1999/xhtml";
let generatedId = 0;

const isElement = (value: unknown): value is Element =>
	typeof value === "object" && value !== null && "nodeType" in value && (value as Node).nodeType === 1;
const isHTMLElement = (element: Element): element is HTMLElement => element.namespaceURI === htmlNamespace;
const isButton = (element: Element): element is HTMLButtonElement =>
	element.namespaceURI === htmlNamespace && element.localName === "button";

/**
 * Coordinates an author-owned tab list and direct child panels without wrapping or rebuilding DOM.
 *
 * The direct child `[slot="tablist"]` contains the native button tabs. Its buttons pair by DOM order with
 * direct child elements using `slot="panel"`.
 */
export class TabsElement extends BaseElement {
	#activeTab: HTMLButtonElement | undefined;
	#focusedTab: HTMLButtonElement | undefined;
	#ownedAttributes = new Map<Element, Map<string, OwnedAttribute>>();
	#panels: HTMLElement[] = [];
	#ready = false;
	#selectionExplicitlyCleared = false;
	#selectedTab: HTMLButtonElement | undefined;
	#tablist: HTMLElement | undefined;
	#tabs: HTMLButtonElement[] = [];

	/** The axis used by arrow-key navigation. Invalid attribute values read as `horizontal`. */
	get orientation(): TabsOrientation {
		return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";
	}

	set orientation(value: TabsOrientation) {
		this.setAttribute("orientation", value === "vertical" ? "vertical" : "horizontal");
		this.#refresh();
	}

	/** Whether focus movement selects immediately or waits for native button activation. */
	get activation(): TabsActivation {
		return this.getAttribute("activation") === "manual" ? "manual" : "automatic";
	}

	set activation(value: TabsActivation) {
		this.setAttribute("activation", value === "manual" ? "manual" : "automatic");
	}

	/** The author-owned direct child that contains the tab buttons. */
	get tablist(): HTMLElement | null {
		this.#refresh();
		return this.#tablist ?? null;
	}

	/** A snapshot of the direct child tab buttons in DOM order. */
	get tabs(): readonly HTMLButtonElement[] {
		this.#refresh();
		return [...this.#tabs];
	}

	/** A snapshot of the direct child panels in DOM order. */
	get panels(): readonly HTMLElement[] {
		this.#refresh();
		return [...this.#panels];
	}

	/** The selected tab's current DOM index, or `-1` when there is no selection. */
	get selectedIndex(): number {
		this.#refresh();
		return this.#selectedTab ? this.#tabs.indexOf(this.#selectedTab) : -1;
	}

	set selectedIndex(index: number) {
		this.#refresh();
		const tab = this.#tabs[index];

		if (tab && !this.#isDisabled(tab)) {
			this.#select(tab, false);
		} else {
			this.#clearSelection();
		}
	}

	/** The selected native button value, or the empty string when there is no selection. */
	get value(): string {
		this.#refresh();
		return this.#selectedTab?.value ?? "";
	}

	set value(value: string) {
		this.#refresh();
		const tab = this.#tabs.find((candidate) => candidate.value === value && !this.#isDisabled(candidate));

		if (tab) {
			this.#select(tab, false);
		} else {
			this.#clearSelection();
		}
	}

	/** The selected direct child button, if any. */
	get selectedTab(): HTMLButtonElement | null {
		this.#refresh();
		return this.#selectedTab ?? null;
	}

	/** The panel paired with the selected tab, if any. */
	get selectedPanel(): HTMLElement | null {
		this.#refresh();
		const index = this.#selectedTab ? this.#tabs.indexOf(this.#selectedTab) : -1;
		return this.#panels[index] ?? null;
	}

	/** Selects an enabled direct child tab without dispatching user-input events. */
	select(target: TabsTarget): boolean {
		this.#refresh();
		const tab = this.#resolve(target);
		if (!tab || this.#isDisabled(tab)) {
			return false;
		}

		this.#select(tab, false);
		return true;
	}

	/** Moves focus to an enabled tab; automatic activation selects it and emits user-input events. */
	focusTab(target: TabsTarget, options?: FocusOptions): boolean {
		this.#refresh();
		const tab = this.#resolve(target);
		if (!tab || this.#isDisabled(tab)) {
			return false;
		}

		this.#setActive(tab);
		tab.focus(options);
		return true;
	}

	protected connect(connection: BaseElement.Connection): void {
		this.#refresh();
		this.addEventListener("click", this.#onClick, { signal: connection.signal });
		this.addEventListener("focusin", this.#onFocusIn, { signal: connection.signal });
		this.addEventListener("keydown", this.#onKeyDown, { signal: connection.signal });
		this.ownerDocument.addEventListener("focusin", this.#onDocumentFocusIn, {
			capture: true,
			signal: connection.signal,
		});

		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: [
				"activation",
				"aria-disabled",
				"aria-selected",
				"disabled",
				"hidden",
				"id",
				"orientation",
				"role",
				"slot",
				"tabindex",
				"type",
				"value",
			],
			attributes: true,
			childList: true,
			subtree: true,
		});
		connection.addCleanup(() => observer.disconnect());
	}

	#onClick = (event: MouseEvent): void => {
		if (event.defaultPrevented) {
			return;
		}
		this.#refresh();
		const tab = this.#tabFromEvent(event);
		if (!tab) {
			return;
		}

		if (this.#isDisabled(tab)) {
			event.preventDefault();
			return;
		}

		this.#select(tab, true);
	};

	#onFocusIn = (event: FocusEvent): void => {
		if (event.defaultPrevented) {
			return;
		}
		this.#refresh();
		if (!isElement(event.target) || !isButton(event.target) || !this.#tabs.includes(event.target)) {
			return;
		}
		if (this.#isDisabled(event.target)) {
			return;
		}
		this.#focusedTab = event.target;

		if (this.activation === "automatic") {
			this.#select(event.target, true);
		} else {
			this.#setActive(event.target);
		}
	};

	#onDocumentFocusIn = (event: FocusEvent): void => {
		this.#focusedTab =
			isElement(event.target) && isButton(event.target) && this.#tabs.includes(event.target)
				? event.target
				: undefined;
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented) {
			return;
		}
		this.#refresh();
		if (event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		if (!isElement(event.target) || !isButton(event.target) || !this.#tabs.includes(event.target)) {
			return;
		}
		if (this.#isDisabled(event.target)) {
			return;
		}

		const enabled = this.#tabs.filter((tab) => !this.#isDisabled(tab));
		if (enabled.length === 0) {
			return;
		}

		const current = enabled.indexOf(event.target);
		let next: HTMLButtonElement | undefined;

		if (event.key === "Home") {
			next = enabled[0];
		} else if (event.key === "End") {
			next = enabled.at(-1);
		} else if (this.orientation === "vertical") {
			if (event.key === "ArrowDown") {
				next = enabled[(current + 1) % enabled.length];
			} else if (event.key === "ArrowUp") {
				next = enabled[(current - 1 + enabled.length) % enabled.length];
			}
		} else {
			const direction = this.ownerDocument.defaultView?.getComputedStyle(this).direction === "rtl" ? -1 : 1;
			if (event.key === "ArrowRight") {
				next = enabled[(current + direction + enabled.length) % enabled.length];
			} else if (event.key === "ArrowLeft") {
				next = enabled[(current - direction + enabled.length) % enabled.length];
			}
		}

		if (!next) {
			return;
		}
		event.preventDefault();
		if (this.activation === "automatic") {
			this.#select(next, true);
		} else {
			this.#setActive(next);
		}
		next.focus();
	};

	#refresh(): void {
		const previousActiveTab = this.#activeTab;
		const previousTabs = this.#tabs;
		const tablist = [...this.children].find(
			(child): child is HTMLElement => isHTMLElement(child) && child.getAttribute("slot") === "tablist",
		);
		const tabs = tablist ? [...tablist.children].filter(isButton) : [];
		const panels = [...this.children].filter(
			(child): child is HTMLElement => isHTMLElement(child) && child.getAttribute("slot") === "panel",
		);

		this.#tablist = tablist;
		this.#tabs = tabs;
		this.#panels = panels;

		if (this.#selectedTab && (!tabs.includes(this.#selectedTab) || this.#isDisabled(this.#selectedTab))) {
			this.#selectedTab = undefined;
		}

		if (!this.#ready && tabs.length > 0) {
			this.#ready = true;
			if (!this.#selectionExplicitlyCleared) {
				this.#selectedTab =
					tabs.find((tab) => tab.getAttribute("aria-selected") === "true" && !this.#isDisabled(tab)) ??
					tabs.find((tab) => !this.#isDisabled(tab));
			}
		}

		if (previousActiveTab && (!tabs.includes(previousActiveTab) || this.#isDisabled(previousActiveTab))) {
			const previousIndex = previousTabs.indexOf(previousActiveTab);
			const nextIndex = tabs.includes(previousActiveTab)
				? tabs.indexOf(previousActiveTab) + 1
				: Math.min(Math.max(previousIndex, 0), tabs.length);
			this.#activeTab =
				tabs.slice(nextIndex).find((tab) => !this.#isDisabled(tab)) ??
				tabs.slice(0, nextIndex).findLast((tab) => !this.#isDisabled(tab));
		}

		this.#activeTab ??= this.#selectedTab ?? tabs.find((tab) => !this.#isDisabled(tab));
		this.#synchronize();

		if (
			previousActiveTab &&
			previousActiveTab === this.#focusedTab &&
			previousActiveTab !== this.#activeTab &&
			this.#activeTab &&
			this.isConnected
		) {
			this.#activeTab.focus();
		}
	}

	#synchronize(): void {
		const retained = new Set<Element>([...this.#tabs, ...this.#panels]);
		if (this.#tablist) {
			retained.add(this.#tablist);
			this.#own(this.#tablist, "role", "tablist");
			this.#own(this.#tablist, "aria-orientation", this.orientation);
		}

		for (let index = 0; index < this.#tabs.length; ++index) {
			const tab = this.#tabs[index];
			const panel = this.#panels[index];
			const selected = tab === this.#selectedTab;

			this.#id(tab, "tab");
			this.#own(tab, "type", "button");
			this.#own(tab, "role", "tab");
			this.#own(tab, "aria-selected", String(selected));
			this.#own(tab, "aria-controls", panel ? this.#id(panel, "panel") : null);
			this.#own(tab, "tabindex", tab === this.#activeTab && !this.#isDisabled(tab) ? "0" : "-1");
		}

		for (let index = 0; index < this.#panels.length; ++index) {
			const panel = this.#panels[index];
			const tab = this.#tabs[index];

			this.#id(panel, "panel");
			this.#own(panel, "role", "tabpanel");
			this.#own(panel, "aria-labelledby", tab ? this.#id(tab, "tab") : null);
			this.#own(panel, "hidden", tab === this.#selectedTab ? null : "");
		}

		for (const element of this.#ownedAttributes.keys()) {
			if (!retained.has(element)) {
				this.#release(element);
			}
		}
	}

	#select(tab: HTMLButtonElement, userInitiated: boolean): boolean {
		const changed = tab !== this.#selectedTab;
		this.#selectionExplicitlyCleared = false;
		this.#selectedTab = tab;
		this.#activeTab = tab;
		this.#synchronize();

		if (changed && userInitiated) {
			const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
			this.dispatchEvent(new EventConstructor("input", { bubbles: true, composed: true }));
			this.dispatchEvent(new EventConstructor("change", { bubbles: true }));
		}

		return changed;
	}

	#clearSelection(): void {
		this.#selectionExplicitlyCleared = true;
		if (!this.#selectedTab) {
			return;
		}
		this.#selectedTab = undefined;
		this.#synchronize();
	}

	#setActive(tab: HTMLButtonElement): void {
		if (tab === this.#activeTab) {
			return;
		}
		this.#activeTab = tab;
		this.#synchronize();
	}

	#resolve(target: TabsTarget): HTMLButtonElement | undefined {
		if (typeof target === "number") {
			return this.#tabs[target];
		}
		if (typeof target === "string") {
			return this.#tabs.find((tab) => tab.value === target);
		}
		return this.#tabs.includes(target) ? target : undefined;
	}

	#tabFromEvent(event: Event): HTMLButtonElement | undefined {
		const path = event.composedPath();
		const tab = path.find(
			(node): node is HTMLButtonElement => isElement(node) && isButton(node) && this.#tabs.includes(node),
		);
		if (!tab) {
			return;
		}

		for (const node of path) {
			if (node === tab) {
				return tab;
			}
			if (isElement(node) && node.matches(interactiveContent)) {
				return;
			}
		}
	}

	#isDisabled(tab: HTMLButtonElement): boolean {
		return tab.disabled || tab.getAttribute("aria-disabled") === "true";
	}

	#id(element: HTMLElement, part: "tab" | "panel"): string {
		const id = element.id || `${this.localName || "base-tabs"}-${part}-${++generatedId}`;
		this.#own(element, "id", id);
		return id;
	}

	#own(element: Element, name: string, value: AttributeValue): void {
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
