import { upgradeProperty } from "./_upgrade.js";
import { BaseElement } from "./BaseElement.js";
import { html } from "./template.js";

export type ToastPriority = "assertive" | "polite";

export interface ToastShowOptions {
	readonly duration?: number;
	readonly priority?: ToastPriority;
}

export interface ToastDismissDetail {
	readonly reason: string;
	readonly toast: HTMLElement;
}

export interface ToastRegionEventMap extends HTMLElementEventMap {
	beforedismiss: CustomEvent<ToastDismissDetail>;
	toastdismiss: CustomEvent<ToastDismissDetail>;
}

interface ToastTimer {
	clear: (() => void) | undefined;
	duration: number;
	now: () => number;
	remaining: number;
	revision: number;
	started: number;
}

interface OwnedType {
	author: string | null;
	owned: string;
}

const htmlNamespace = "http://www.w3.org/1999/xhtml";
const implicitLiveRoles = new Set(["alert", "log", "marquee", "status", "timer"]);
const toastRevisions = new WeakMap<HTMLElement, number>();
const focusableSelector =
	"a[href], area[href], audio[controls], button, iframe, input, select, summary, textarea, video[controls], [contenteditable], [tabindex]";

/** Coordinates authored local toast nodes, their timers, announcements, and optional F6 focus. */
export class ToastRegionElement extends BaseElement {
	static readonly observedAttributes = ["duration", "f6"];

	#announcerAssertive: HTMLElement | undefined;
	#announcerPolite: HTMLElement | undefined;
	#activeTimers = new Set<HTMLElement>();
	#connectionEpoch = 0;
	#dismissTypes = new Map<HTMLButtonElement, OwnedType>();
	#hovered = new Set<HTMLElement>();
	#dismissing = new Set<HTMLElement>();
	#signal: AbortSignal | undefined;
	#timerStates = new WeakMap<HTMLElement, ToastTimer>();

	declare addEventListener: {
		<Type extends keyof ToastRegionEventMap>(
			type: Type,
			listener: (this: ToastRegionElement, event: ToastRegionEventMap[Type]) => unknown,
			options?: boolean | AddEventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | AddEventListenerOptions,
		): void;
	};
	declare removeEventListener: {
		<Type extends keyof ToastRegionEventMap>(
			type: Type,
			listener: (this: ToastRegionElement, event: ToastRegionEventMap[Type]) => unknown,
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
		for (const property of ["duration", "f6"] as const) {
			upgradeProperty(this, property);
		}
	}

	get duration(): number {
		const attribute = this.getAttribute("duration");
		if (attribute === null || attribute.trim() === "") {
			return 5000;
		}
		const value = Number(attribute);
		return Number.isFinite(value) && value >= 0 ? value : 5000;
	}

	set duration(value: number) {
		if (!Number.isFinite(value) || value < 0) {
			throw new TypeError("Toast duration must be a finite nonnegative number");
		}
		this.setAttribute("duration", String(value));
	}

	get f6(): boolean {
		return this.hasAttribute("f6");
	}

	set f6(value: boolean) {
		this.toggleAttribute("f6", Boolean(value));
	}

	show(id: string, options: ToastShowOptions = {}): HTMLElement {
		const toast = this.#requireToast(id);
		const duration = options.duration ?? this.#toastDuration(toast);
		if (!Number.isFinite(duration) || duration < 0) {
			throw new TypeError("Toast duration must be a finite nonnegative number");
		}
		if (options.priority !== undefined && options.priority !== "polite" && options.priority !== "assertive") {
			throw new TypeError("Toast priority must be polite or assertive");
		}

		const revision = bumpToastRevision(toast);
		toast.hidden = false;
		this.#pause(toast);
		this.#timerStates.delete(toast);
		const timer: ToastTimer = {
			clear: undefined,
			duration,
			now: () => 0,
			remaining: duration,
			revision,
			started: 0,
		};
		this.#timerStates.set(toast, timer);
		if (this.#signal && !this.#signal.aborted) {
			this.#activeTimers.add(toast);
		}
		if (!this.#isPaused(toast)) {
			this.#startTimer(toast, timer);
		}
		this.#announce(
			toast,
			timer,
			revision,
			options.priority ?? (toast.getAttribute("role") === "alert" ? "assertive" : "polite"),
		);
		return toast;
	}

	dismiss(id: string, reason = "programmatic"): boolean {
		return this.#dismissToast(this.#requireToast(id), String(reason));
	}

	#dismissToast(toast: HTMLElement, reason: string): boolean {
		if (toast.hidden || this.#dismissing.has(toast) || !this.#isLiveToast(toast)) {
			return false;
		}
		const id = toast.id;
		const revision = toastRevision(toast);
		const signal = this.#signal;
		const document = this.ownerDocument;
		const detail = Object.freeze({ reason, toast });
		const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
		const before = new EventConstructor<ToastDismissDetail>("beforedismiss", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail,
		});
		this.#dismissing.add(toast);
		let accepted: boolean;
		try {
			accepted = this.dispatchEvent(before);
		} finally {
			this.#dismissing.delete(toast);
		}
		if (
			!accepted ||
			toastRevision(toast) !== revision ||
			this.#signal !== signal ||
			this.ownerDocument !== document ||
			signal?.aborted ||
			toast.id !== id ||
			toast.hidden ||
			!this.#isLiveToast(toast)
		) {
			return false;
		}

		bumpToastRevision(toast);
		this.#stopTimer(toast);
		toast.hidden = true;
		this.dispatchEvent(
			new EventConstructor<ToastDismissDetail>("toastdismiss", { bubbles: true, composed: true, detail }),
		);
		return true;
	}

	override focus(options?: FocusOptions): void {
		if (!this.#focusInto(options)) {
			super.focus(options);
		}
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout() {
		this.#announcerPolite = this.#createAnnouncer(this.ownerDocument, "polite");
		this.#announcerAssertive = this.#createAnnouncer(this.ownerDocument, "assertive");

		return html`<slot name="toast" part="toast"></slot>${this.#announcerPolite}${this.#announcerAssertive}`;
	}

	protected override connect(connection: BaseElement.Connection): void {
		const epoch = ++this.#connectionEpoch;
		this.#signal = connection.signal;
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer((records) => this.#mutated(records));
		connection.addCleanup(() => {
			observer.disconnect();
			this.#releaseDismissTypes();
			for (const toast of this.#activeTimers) {
				this.#pause(toast);
			}
			this.#activeTimers.clear();
			this.#hovered.clear();
			if (this.#connectionEpoch === epoch) {
				++this.#connectionEpoch;
				this.#signal = undefined;
			}
		});
		observer.observe(this, {
			attributeFilter: ["hidden", "id", "slot", "type"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		this.addEventListener("click", this.#onClick, { signal: connection.signal });
		this.addEventListener("focusin", this.#onFocusIn, { signal: connection.signal });
		this.addEventListener("focusout", this.#onFocusOut, { signal: connection.signal });
		this.addEventListener("pointerover", this.#onPointerOver, { signal: connection.signal });
		this.addEventListener("pointerout", this.#onPointerOut, { signal: connection.signal });
		this.ownerDocument.addEventListener("keydown", this.#onKeyDown, { signal: connection.signal });
		this.ownerDocument.addEventListener("visibilitychange", this.#onVisibilityChange, {
			signal: connection.signal,
		});
		this.#reconcile();
	}

	#toasts(): HTMLElement[] {
		return [...this.children].filter(
			(child): child is HTMLElement =>
				child.namespaceURI === htmlNamespace && (child as HTMLElement).slot === "toast" && child.id !== "",
		);
	}

	#requireToast(id: string): HTMLElement {
		const matches = this.#toasts().filter((toast) => toast.id === String(id));
		if (matches.length === 1) {
			return matches[0];
		}
		const Exception = this.ownerDocument.defaultView?.DOMException ?? DOMException;
		throw new Exception(
			matches.length === 0 ? `Toast ${id} does not exist` : `Toast ${id} is not unique`,
			matches.length === 0 ? "NotFoundError" : "InvalidStateError",
		);
	}

	#isLiveToast(toast: HTMLElement): boolean {
		return (
			toast.parentElement === this &&
			toast.slot === "toast" &&
			toast.id !== "" &&
			this.#toastsById(toast.id) === 1
		);
	}

	#toastsById(id: string): number {
		let count = 0;
		for (const toast of this.#toasts()) {
			if (toast.id === id) {
				++count;
			}
		}
		return count;
	}

	#toastFromEvent(event: Event): HTMLElement | undefined {
		return event
			.composedPath()
			.find(
				(node): node is HTMLElement =>
					(node as Node).nodeType === 1 &&
					(node as HTMLElement).namespaceURI === htmlNamespace &&
					(node as HTMLElement).parentElement === this &&
					(node as HTMLElement).slot === "toast",
			);
	}

	#toastDuration(toast: HTMLElement): number {
		const value = toast.getAttribute("data-base-duration");
		if (value === null || value.trim() === "") {
			return this.duration;
		}
		return Number(value);
	}

	#reconcile(): void {
		const current = new Set(this.#toasts());
		this.#reconcileDismissTypes(current);
		for (const toast of this.#hovered) {
			if (!current.has(toast) || toast.hidden) {
				this.#hovered.delete(toast);
			}
		}
		for (const toast of this.#activeTimers) {
			if (!current.has(toast) || toast.hidden || this.#toastsById(toast.id) !== 1) {
				this.#stopTimer(toast);
			}
		}
		for (const toast of current) {
			const timer = this.#timerStates.get(toast);
			if (!timer) {
				continue;
			}
			if (toast.hidden || this.#toastsById(toast.id) !== 1 || timer.revision !== toastRevision(toast)) {
				this.#stopTimer(toast);
				continue;
			}
			this.#activeTimers.add(toast);
			if (!toast.hidden && !this.#isPaused(toast) && timer.clear === undefined) {
				this.#startTimer(toast, timer);
			}
		}
	}

	#mutated(records: MutationRecord[]): void {
		for (const record of records) {
			const changedInside = (toast: HTMLElement): boolean =>
				record.target === toast || (record.target.nodeType === 1 && toast.contains(record.target));
			for (const removed of record.removedNodes) {
				for (const toast of this.#hovered) {
					if (
						removed === toast ||
						(removed.nodeType === 1 && (removed as Element).contains(toast)) ||
						(changedInside(toast) && !toast.matches(":hover"))
					) {
						this.#hovered.delete(toast);
					}
				}
			}
		}
		this.#reconcile();
	}

	#reconcileDismissTypes(toasts: Set<HTMLElement>): void {
		const current = new Set<HTMLButtonElement>();
		for (const toast of toasts) {
			for (const element of toast.querySelectorAll('button[slot="dismiss"]')) {
				if (element.namespaceURI !== htmlNamespace || element.localName !== "button") {
					continue;
				}
				const button = element as HTMLButtonElement;
				current.add(button);
				const value = button.getAttribute("type");
				let state = this.#dismissTypes.get(button);
				if (!state) {
					state = { author: value, owned: value ?? "" };
					this.#dismissTypes.set(button, state);
				} else if (value !== state.owned) {
					state.author = value;
				}
				if (value !== "button") {
					button.type = "button";
				}
				state.owned = "button";
			}
		}
		for (const [button, state] of this.#dismissTypes) {
			if (!current.has(button)) {
				this.#releaseDismissType(button, state);
			}
		}
	}

	#releaseDismissTypes(): void {
		for (const [button, state] of this.#dismissTypes) {
			this.#releaseDismissType(button, state);
		}
	}

	#releaseDismissType(button: HTMLButtonElement, state: OwnedType): void {
		if (button.getAttribute("type") === state.owned) {
			if (state.author === null) {
				button.removeAttribute("type");
			} else {
				button.setAttribute("type", state.author);
			}
		}
		this.#dismissTypes.delete(button);
	}

	#startTimer(toast: HTMLElement, timer: ToastTimer): void {
		const view = this.ownerDocument.defaultView;
		if (
			timer.duration === 0 ||
			timer.remaining <= 0 ||
			timer.revision !== toastRevision(toast) ||
			timer.clear !== undefined ||
			!this.#signal ||
			this.#signal.aborted ||
			!view
		) {
			return;
		}
		const clock = view.performance;
		timer.now = () => clock.now();
		timer.started = timer.now();
		const handle = view.setTimeout(() => {
			timer.clear = undefined;
			timer.remaining = 0;
			if (this.#timerStates.get(toast) === timer && timer.revision === toastRevision(toast)) {
				if (this.#isLiveToast(toast) && !toast.hidden) {
					this.#dismissToast(toast, "timeout");
				} else {
					this.#stopTimer(toast);
				}
			}
		}, timer.remaining);
		timer.clear = () => view.clearTimeout(handle);
	}

	#pause(toast: HTMLElement): void {
		const timer = this.#timerStates.get(toast);
		if (!timer || timer.clear === undefined) {
			return;
		}
		timer.clear();
		timer.clear = undefined;
		timer.remaining = Math.max(0, timer.remaining - (timer.now() - timer.started));
	}

	#resume(toast: HTMLElement): void {
		const timer = this.#timerStates.get(toast);
		if (timer && !toast.hidden && !this.#isPaused(toast)) {
			this.#startTimer(toast, timer);
		}
	}

	#stopTimer(toast: HTMLElement): void {
		this.#pause(toast);
		this.#timerStates.delete(toast);
		this.#activeTimers.delete(toast);
		this.#hovered.delete(toast);
	}

	#isPaused(toast: HTMLElement): boolean {
		return this.ownerDocument.hidden || this.#hovered.has(toast) || toast.matches(":focus-within");
	}

	#announce(toast: HTMLElement, timer: ToastTimer, revision: number, priority: ToastPriority): void {
		const roles = (toast.getAttribute("role") ?? "").toLowerCase().trim().split(/\s+/);
		if (toast.hasAttribute("aria-live") || (roles.length === 1 && implicitLiveRoles.has(roles[0]))) {
			return;
		}
		const announcer = priority === "assertive" ? this.#announcerAssertive : this.#announcerPolite;
		if (!announcer) {
			return;
		}
		announcer.textContent = "";
		const epoch = this.#connectionEpoch;
		queueMicrotask(() => {
			if (
				epoch === this.#connectionEpoch &&
				!this.#signal?.aborted &&
				!toast.hidden &&
				this.#timerStates.get(toast) === timer &&
				toastRevision(toast) === revision &&
				this.#isLiveToast(toast)
			) {
				announcer.textContent = announcementText(toast);
			}
		});
	}

	#createAnnouncer(document: Document, priority: ToastPriority): HTMLElement {
		const announcer = document.createElement("span");
		announcer.part.add(`announcer-${priority}`);
		announcer.setAttribute("aria-atomic", "true");
		announcer.setAttribute("aria-live", priority);
		announcer.style.cssText =
			"position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
		return announcer;
	}

	#onClick = (event: MouseEvent): void => {
		if (event.defaultPrevented) {
			return;
		}
		const path = event.composedPath();
		const button = path.find(
			(node): node is HTMLButtonElement =>
				(node as Node).nodeType === 1 &&
				(node as Element).namespaceURI === htmlNamespace &&
				(node as Element).localName === "button" &&
				(node as HTMLButtonElement).slot === "dismiss" &&
				!(node as HTMLButtonElement).matches(":disabled"),
		);
		const toast = this.#toastFromEvent(event);
		if (button && toast?.contains(button)) {
			event.preventDefault();
			this.#dismissToast(toast, "dismiss");
		}
	};

	#onPointerOver = (event: PointerEvent): void => {
		const toast = this.#toastFromEvent(event);
		if (toast) {
			this.#hovered.add(toast);
			this.#pause(toast);
		}
	};

	#onPointerOut = (event: PointerEvent): void => {
		const toast = this.#toastFromEvent(event);
		if (
			!toast ||
			((event.relatedTarget as Node | null)?.nodeType !== undefined &&
				toast.contains(event.relatedTarget as Node))
		) {
			return;
		}
		this.#hovered.delete(toast);
		this.#resume(toast);
	};

	#onFocusIn = (event: FocusEvent): void => {
		const toast = this.#toastFromEvent(event);
		if (toast) {
			this.#pause(toast);
		}
	};

	#onFocusOut = (event: FocusEvent): void => {
		const toast = this.#toastFromEvent(event);
		if (
			!toast ||
			((event.relatedTarget as Node | null)?.nodeType !== undefined &&
				toast.contains(event.relatedTarget as Node))
		) {
			return;
		}
		this.#resume(toast);
	};

	#onVisibilityChange = (): void => {
		for (const toast of this.#activeTimers) {
			if (this.ownerDocument.hidden) {
				this.#pause(toast);
			} else {
				this.#resume(toast);
			}
		}
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		if (
			!this.f6 ||
			event.defaultPrevented ||
			event.key !== "F6" ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			event.shiftKey
		) {
			return;
		}
		if (this.#focusInto()) {
			event.preventDefault();
		}
	};

	#focusInto(options?: FocusOptions): boolean {
		const toast = this.#toasts().find((candidate) => !candidate.hidden);
		if (!toast) {
			return false;
		}
		const candidates = [
			...toast.querySelectorAll<HTMLElement>(focusableSelector),
			toast,
			...(this.tabIndex >= 0 ? [this] : []),
		];
		for (const candidate of candidates) {
			if (
				candidate.matches(":disabled") ||
				candidate.closest("[hidden], [inert]") ||
				candidate.namespaceURI !== htmlNamespace
			) {
				continue;
			}
			candidate.focus(options);
			if (this.contains(this.ownerDocument.activeElement) || this.ownerDocument.activeElement === this) {
				return true;
			}
		}
		return false;
	}
}

const announcementText = (toast: HTMLElement): string => {
	const text: string[] = [];
	const visit = (node: Node, textVisible = true): void => {
		if (node.nodeType === 3) {
			if (textVisible) {
				text.push(node.nodeValue ?? "");
			}
			return;
		}
		if (node.nodeType !== 1) {
			return;
		}
		const element = node as Element;
		const style = element.ownerDocument.defaultView?.getComputedStyle(element);
		if (
			element.getAttribute("slot") === "dismiss" ||
			element.getAttribute("aria-hidden")?.trim().toLowerCase() === "true" ||
			element.hasAttribute("hidden") ||
			element.hasAttribute("inert") ||
			style?.display === "none"
		) {
			return;
		}
		const visible = style === undefined || style.visibility === "visible";
		const separates =
			element.localName === "br" ||
			(style !== undefined && style.display !== "contents" && !style.display.startsWith("inline"));
		if (separates) {
			text.push(" ");
		}
		for (const child of node.childNodes) {
			visit(child, child.nodeType === 1 ? true : visible);
		}
		if (separates) {
			text.push(" ");
		}
	};
	visit(toast);
	return text.join("").replaceAll(/\s+/g, " ").trim();
};

const toastRevision = (toast: HTMLElement): number => toastRevisions.get(toast) ?? 0;

const bumpToastRevision = (toast: HTMLElement): number => {
	const revision = toastRevision(toast) + 1;
	toastRevisions.set(toast, revision);
	return revision;
};
