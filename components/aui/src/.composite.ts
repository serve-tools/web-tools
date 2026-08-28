import { AttributeOwner } from "./.popover.js";

/** An axis used by a scoped composite collection. */
export type CompositeOrientation = "horizontal" | "vertical";

/** One actual DOM focus target in a family-owned collection snapshot. */
export interface CompositeEntry {
	readonly element: HTMLElement;
	readonly disabled: boolean;
	readonly text: string;
}

/** Result for an axis key that belongs to a composite, whether or not focus changed. */
export interface CompositeMovement {
	readonly moved: HTMLElement | null;
}

/** A timeout paired with the Window that allocated its numeric handle. */
export interface RealmTimeout {
	readonly id: number;
	readonly view: Window;
}

/** Starts one timeout in an element's current owner realm. */
export const setRealmTimeout = (host: Element, callback: () => void, delay: number): RealmTimeout | undefined => {
	const view = host.ownerDocument.defaultView;
	return view ? { id: view.setTimeout(callback, delay), view } : undefined;
};

/** Clears a timeout through the same realm that allocated it. */
export const clearRealmTimeout = (timeout: RealmTimeout | undefined): void => {
	if (timeout) {
		timeout.view.clearTimeout(timeout.id);
	}
};

const printable = /^.$/u;

/** Realm-safe HTML element check. */
export const isHTMLElement = (value: unknown): value is HTMLElement =>
	typeof value === "object" &&
	value !== null &&
	"namespaceURI" in value &&
	(value as Element).namespaceURI === "http://www.w3.org/1999/xhtml";

/** Whether a native control is unavailable as a focus target. */
export const isNativelyDisabled = (element: HTMLElement): boolean =>
	(element.localName === "button" ||
		element.localName === "input" ||
		element.localName === "select" ||
		element.localName === "textarea") &&
	element.matches(":disabled");

/** Whether authored DOM state prevents a candidate from receiving focus. */
export const isCompositeUnavailable = (element: HTMLElement, boundary: Element): boolean => {
	if (
		isNativelyDisabled(element) ||
		(element.localName === "input" && (element as HTMLInputElement).type === "hidden")
	) {
		return true;
	}
	for (let current: Element | null = element; current; current = current.parentElement) {
		if (current.hasAttribute("hidden") || current.hasAttribute("inert")) {
			return true;
		}
		if (current === boundary) {
			break;
		}
	}
	return false;
};

/** Finds an element in an event path before a different interactive collection owns it. */
export const pathElement = (event: Event, candidates: readonly HTMLElement[]): HTMLElement | undefined => {
	for (const node of event.composedPath()) {
		if (isHTMLElement(node) && candidates.includes(node)) {
			return node;
		}
	}
	return undefined;
};

/** A small scoped roving-focus and typeahead controller. */
export class CompositeCollection {
	#active: HTMLElement | undefined;
	#entries: readonly CompositeEntry[] = [];
	readonly #host: HTMLElement;
	readonly #owner = new AttributeOwner();
	readonly #resolve: () => readonly CompositeEntry[];
	#search = "";
	#searchTimer: RealmTimeout | undefined;

	constructor(host: HTMLElement, resolve: () => readonly CompositeEntry[]) {
		this.#host = host;
		this.#resolve = resolve;
	}

	get activeElement(): HTMLElement | null {
		this.refresh();
		return this.#active ?? null;
	}

	get entries(): readonly CompositeEntry[] {
		this.refresh();
		return this.#entries;
	}

	refresh(): void {
		const previous = this.#entries;
		const seen = new Set<HTMLElement>();
		const entries: CompositeEntry[] = [];
		for (const entry of this.#resolve()) {
			if (!seen.has(entry.element)) {
				seen.add(entry.element);
				entries.push({
					...entry,
					disabled: entry.disabled || isCompositeUnavailable(entry.element, this.#host),
				});
			}
		}

		for (const entry of previous) {
			if (!seen.has(entry.element)) {
				this.#owner.releaseAttribute(entry.element, "tabindex");
			}
		}
		this.#entries = Object.freeze(entries);

		const focused = entries.find(
			(entry) => entry.element === this.#host.ownerDocument.activeElement && !entry.disabled,
		);
		const authored = entries.find(
			(entry) => !entry.disabled && this.#owner.authorValue(entry.element, "tabindex") === "0",
		);
		if (focused) {
			this.#active = focused.element;
		} else if (!this.#active || !entries.some((entry) => entry.element === this.#active && !entry.disabled)) {
			this.#active = authored?.element ?? entries.find((entry) => !entry.disabled)?.element;
		}

		for (const entry of entries) {
			this.#owner.own(entry.element, "tabindex", entry.element === this.#active && !entry.disabled ? "0" : "-1");
		}
	}

	release(): void {
		this.#clearSearch();
		for (const entry of this.#entries) {
			this.#owner.releaseAttribute(entry.element, "tabindex");
		}
		this.#entries = [];
		this.#active = undefined;
	}

	clearTypeahead(): void {
		this.#clearSearch();
	}

	contains(element: HTMLElement): boolean {
		return this.entries.some((entry) => entry.element === element);
	}

	setActive(element: HTMLElement): boolean {
		this.refresh();
		if (!this.#entries.some((entry) => entry.element === element && !entry.disabled)) {
			return false;
		}
		this.#active = element;
		this.#synchronize();
		return true;
	}

	focus(element: HTMLElement, options?: FocusOptions): boolean {
		if (!this.setActive(element)) {
			return false;
		}
		element.focus(options);
		if (this.#host.ownerDocument.activeElement === element) {
			return true;
		}
		this.refresh();
		const focused = this.#entries.find(
			(entry) => entry.element === this.#host.ownerDocument.activeElement && !entry.disabled,
		);
		this.#active = focused?.element ?? this.#active;
		this.#synchronize();
		return false;
	}

	move(
		current: HTMLElement,
		key: string,
		orientation: CompositeOrientation,
		loop: boolean,
		homeEnd = true,
	): CompositeMovement | undefined {
		this.refresh();
		const enabled = this.#entries.filter((entry) => !entry.disabled).map((entry) => entry.element);
		const index = enabled.indexOf(current);
		if (index < 0 || enabled.length === 0) {
			return;
		}

		let next: number | undefined;
		if (homeEnd && key === "Home") {
			next = 0;
		} else if (homeEnd && key === "End") {
			next = enabled.length - 1;
		} else if (orientation === "vertical") {
			if (key === "ArrowDown") {
				next = index + 1;
			}
			if (key === "ArrowUp") {
				next = index - 1;
			}
		} else {
			const rtl = this.#host.ownerDocument.defaultView?.getComputedStyle(this.#host).direction === "rtl";
			if (key === "ArrowRight") {
				next = index + (rtl ? -1 : 1);
			}
			if (key === "ArrowLeft") {
				next = index + (rtl ? 1 : -1);
			}
		}
		if (next === undefined) {
			return;
		}
		if (loop) {
			next = (next + enabled.length) % enabled.length;
		} else if (next < 0 || next >= enabled.length) {
			return { moved: null };
		}

		const target = enabled[next];
		if (target && target !== current) {
			return { moved: this.focus(target) ? target : null };
		}
		return { moved: null };
	}

	typeahead(event: KeyboardEvent, current: HTMLElement): HTMLElement | undefined {
		if (event.altKey || event.ctrlKey || event.metaKey || event.key === " " || !printable.test(event.key)) {
			return;
		}
		this.refresh();
		const enabled = this.#entries.filter((entry) => !entry.disabled && entry.text.trim() !== "");
		if (enabled.length === 0) {
			return;
		}

		const character = event.key.toLocaleLowerCase();
		this.#search += character;
		const repeated = [...this.#search].every((value) => value === character);
		const query = repeated ? character : this.#search;
		this.#restartSearchTimer();

		const currentIndex = enabled.findIndex((entry) => entry.element === current);
		for (let offset = 1; offset <= enabled.length; ++offset) {
			const entry = enabled[(Math.max(currentIndex, -1) + offset) % enabled.length];
			if (entry?.text.trim().toLocaleLowerCase().startsWith(query) && this.focus(entry.element)) {
				return entry.element;
			}
		}
		return;
	}

	#synchronize(): void {
		for (const entry of this.#entries) {
			this.#owner.own(entry.element, "tabindex", entry.element === this.#active && !entry.disabled ? "0" : "-1");
		}
	}

	#restartSearchTimer(): void {
		this.#clearSearchTimer();
		this.#searchTimer = setRealmTimeout(
			this.#host,
			() => {
				this.#searchTimer = undefined;
				this.#search = "";
			},
			500,
		);
	}

	#clearSearchTimer(): void {
		clearRealmTimeout(this.#searchTimer);
		this.#searchTimer = undefined;
	}

	#clearSearch(): void {
		this.#clearSearchTimer();
		this.#search = "";
	}
}

/** Whether an axis arrow should leave a native text editor at its caret boundary. */
export const textEditorConsumesArrow = (
	element: HTMLElement,
	event: KeyboardEvent,
	orientation: CompositeOrientation,
	rtl: boolean,
): boolean => {
	if (element.localName !== "input" && element.localName !== "textarea") {
		return false;
	}
	if (element.localName === "input") {
		const input = element as HTMLInputElement;
		if (
			["date", "datetime-local", "email", "month", "number", "radio", "range", "time", "week"].includes(
				input.type,
			)
		) {
			return true;
		}
		if (!["password", "search", "tel", "text", "url"].includes(input.type)) {
			return false;
		}
	}
	const editor = element as HTMLInputElement | HTMLTextAreaElement;
	if (event.shiftKey || editor.selectionStart === null || editor.selectionEnd === null) {
		return true;
	}
	if (editor.selectionStart !== editor.selectionEnd) {
		return true;
	}
	const forward = orientation === "vertical" ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
	const backward = orientation === "vertical" ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
	if (event.key === forward) {
		return editor.selectionEnd < editor.value.length;
	}
	if (event.key === backward) {
		return editor.selectionStart > 0;
	}
	return false;
};
