import { NativePopoverElement } from "./.popover.js";
import type { AUIElement } from "./aui-element.js";

interface Timer {
	readonly id: number;
	readonly view: Window;
}

const htmlNamespace = "http://www.w3.org/1999/xhtml";
const tooltipTrigger = "button, input:not([type='hidden']), select, textarea, a[href], [tabindex]";
const isNode = (value: unknown): value is Node =>
	typeof value === "object" && value !== null && "nodeType" in value && typeof (value as Node).nodeType === "number";

/** Shared hover, focus, delay, and occupancy behavior for retained native popovers. */
export abstract class HoverPopoverElement extends NativePopoverElement {
	#closeGuardTimer: Timer | undefined;
	#closeTimer: Timer | undefined;
	#closing = false;
	#openTimer: Timer | undefined;

	/** The current authored trigger. */
	abstract get trigger(): HTMLElement | null;

	/** Delay before pointer hover opens the popup, in milliseconds. */
	abstract get delay(): number;

	/** Delay before an unoccupied popup closes, in milliseconds. */
	abstract get closeDelay(): number;

	/** Shows the popup with the current trigger as its native source. */
	override show(): void {
		const trigger = this.trigger;
		if (!trigger) {
			const Exception = this.ownerDocument.defaultView?.DOMException ?? DOMException;
			throw new Exception("Hover overlay element requires a direct trigger", "InvalidStateError");
		}

		super.show(trigger);
	}

	/** Hides the popup without treating native focus restoration as a new request to open. */
	override hide(): void {
		this.#clearTimers();
		this.#closing = true;
		try {
			super.hide();
		} catch (error) {
			this.#closing = false;
			throw error;
		}
	}

	protected override connect(connection: AUIElement.Connection): void {
		super.connect(connection);
		this.addEventListener("pointerover", this.#onPointerOver, { signal: connection.signal });
		this.addEventListener("pointerout", this.#onPointerOut, { signal: connection.signal });
		this.addEventListener("focusin", this.#onFocusIn, { signal: connection.signal });
		this.addEventListener("focusout", this.#onFocusOut, { signal: connection.signal });
		connection.addCleanup(() => {
			this.#clearTimers();
			this.#clearCloseGuard();
		});
	}

	protected override toggled(event: ToggleEvent): void {
		this.#clearCloseGuard();
		if (event.newState === "closed") {
			this.#clearTimers();
		}
	}

	protected override beforeToggled(event: ToggleEvent): void {
		if (event.newState === "closed") {
			this.#closing = true;
			this.#scheduleCloseGuardRelease();
		} else {
			this.#clearCloseGuard();
		}
	}

	protected findTooltipTrigger(): HTMLElement | undefined {
		let fallback: HTMLElement | undefined;

		for (const child of this.children) {
			if (child.namespaceURI !== htmlNamespace || child.hasAttribute("popover")) {
				continue;
			}

			const element = child as HTMLElement;
			if (element.slot === "trigger") {
				return element;
			}
			if (!fallback && element.matches(tooltipTrigger)) {
				fallback = element;
			}
		}

		return fallback;
	}

	protected findLinkTrigger(): HTMLAnchorElement | undefined {
		let fallback: HTMLAnchorElement | undefined;

		for (const child of this.children) {
			if (child.namespaceURI !== htmlNamespace || child.localName !== "a" || !child.hasAttribute("href")) {
				continue;
			}

			const link = child as HTMLAnchorElement;
			if (link.slot === "trigger") {
				return link;
			}
			fallback ??= link;
		}

		return fallback;
	}

	#onPointerOver = (event: PointerEvent): void => {
		if (event.pointerType !== "mouse" && event.pointerType !== "pen") {
			return;
		}

		const trigger = this.trigger;
		const popup = this.popup;
		const target = event.target;
		const related = event.relatedTarget;
		if (!trigger || !isNode(target)) {
			return;
		}

		if (trigger.contains(target)) {
			if (isNode(related) && trigger.contains(related)) {
				return;
			}
			this.#cancelClose();
			this.#scheduleOpen(trigger, popup);
		} else if (popup?.contains(target)) {
			this.#cancelClose();
		}
	};

	#onPointerOut = (event: PointerEvent): void => {
		if (event.pointerType !== "mouse" && event.pointerType !== "pen") {
			return;
		}

		const trigger = this.trigger;
		const popup = this.popup;
		const target = event.target;
		if (!isNode(target) || (!trigger?.contains(target) && !popup?.contains(target))) {
			return;
		}

		const related = event.relatedTarget;
		if (isNode(related) && (trigger?.contains(related) || popup?.contains(related))) {
			this.#cancelClose();
			return;
		}

		this.#cancelOpen();
		this.#scheduleClose(popup);
	};

	#onFocusIn = (event: FocusEvent): void => {
		if (this.#closing) {
			return;
		}

		const trigger = this.trigger;
		const popup = this.popup;
		const target = event.target;
		if (!isNode(target)) {
			return;
		}

		if (trigger?.contains(target)) {
			this.#clearTimers();
			this.#open(trigger, popup);
		} else if (popup?.contains(target)) {
			this.#cancelClose();
		}
	};

	#onFocusOut = (event: FocusEvent): void => {
		const trigger = this.trigger;
		const popup = this.popup;
		const target = event.target;
		if (!isNode(target) || (!trigger?.contains(target) && !popup?.contains(target))) {
			return;
		}

		const related = event.relatedTarget;
		if (isNode(related) && (trigger?.contains(related) || popup?.contains(related))) {
			return;
		}

		this.#scheduleClose(popup);
	};

	#scheduleOpen(trigger: HTMLElement, popup: HTMLElement | null): void {
		this.#cancelOpen();
		if (!popup || popup.matches(":popover-open")) {
			return;
		}

		const view = this.ownerDocument.defaultView;
		if (!view) {
			return;
		}
		const delay = this.delay;
		if (delay === 0) {
			this.#open(trigger, popup);
			return;
		}

		const id = view.setTimeout(() => {
			this.#openTimer = undefined;
			this.#open(trigger, popup);
		}, delay);
		this.#openTimer = { id, view };
	}

	#scheduleClose(popup: HTMLElement | null): void {
		this.#cancelClose();
		if (!popup?.matches(":popover-open")) {
			return;
		}

		const view = this.ownerDocument.defaultView;
		if (!view) {
			return;
		}
		const delay = this.closeDelay;
		if (delay === 0) {
			this.#close(popup);
			return;
		}

		const id = view.setTimeout(() => {
			this.#closeTimer = undefined;
			this.#close(popup);
		}, delay);
		this.#closeTimer = { id, view };
	}

	#open(trigger: HTMLElement, popup: HTMLElement | null): void {
		if (
			!this.isConnected ||
			this.trigger !== trigger ||
			this.popup !== popup ||
			!popup ||
			popup.matches(":popover-open")
		) {
			return;
		}

		this.showPopup(trigger, popup);
	}

	/** Performs the native opening after trigger, popup, connection, and stale-delay validation. */
	protected showPopup(trigger: HTMLElement, popup: HTMLElement): void {
		popup.showPopover({ source: trigger });
	}

	#close(popup: HTMLElement): void {
		if (!this.isConnected || this.popup !== popup || !popup.matches(":popover-open")) {
			return;
		}

		this.hide();
	}

	#cancelOpen(): void {
		if (!this.#openTimer) {
			return;
		}
		this.#openTimer.view.clearTimeout(this.#openTimer.id);
		this.#openTimer = undefined;
	}

	#cancelClose(): void {
		if (!this.#closeTimer) {
			return;
		}
		this.#closeTimer.view.clearTimeout(this.#closeTimer.id);
		this.#closeTimer = undefined;
	}

	#clearTimers(): void {
		this.#cancelOpen();
		this.#cancelClose();
	}

	#scheduleCloseGuardRelease(): void {
		if (this.#closeGuardTimer) {
			this.#closeGuardTimer.view.clearTimeout(this.#closeGuardTimer.id);
		}
		const view = this.ownerDocument.defaultView;
		if (!view) {
			this.#closing = false;
			this.#closeGuardTimer = undefined;
			return;
		}

		const id = view.setTimeout(() => {
			this.#closing = false;
			this.#closeGuardTimer = undefined;
		});
		this.#closeGuardTimer = { id, view };
	}

	#clearCloseGuard(): void {
		if (this.#closeGuardTimer) {
			this.#closeGuardTimer.view.clearTimeout(this.#closeGuardTimer.id);
			this.#closeGuardTimer = undefined;
		}
		this.#closing = false;
	}
}
