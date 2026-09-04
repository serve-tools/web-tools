import type { RealmTimeout } from "./.composite.js";
import { clearRealmTimeout, isHTMLElement, setRealmTimeout } from "./.composite.js";
import { AttributeOwner } from "./.ownership.js";
import type { AUIElement } from "./aui-element.js";
import { MenuElement } from "./menu-element.js";

/** A point used to open a context menu in viewport coordinates. */
export interface ContextMenuPoint {
	readonly x: number;
	readonly y: number;
}

/** Opens an author-owned native menu popover from context-menu input. */
export class ContextMenuElement extends MenuElement {
	#contextTrigger: HTMLElement | undefined;
	#initializedContext = false;
	#longPressPointer: { id: number; point: ContextMenuPoint; trigger: HTMLElement } | undefined;
	#longPressPopup: HTMLElement | undefined;
	#longPressTimer: RealmTimeout | undefined;
	readonly #owner = new AttributeOwner();

	/** The exact direct element carrying `slot="trigger"`. */
	override get trigger(): HTMLElement | null {
		this.#refreshContext();
		return this.#contextTrigger ?? null;
	}

	override show(source?: HTMLElement): void {
		super.show(source ?? this.trigger ?? undefined);
	}

	/** Shows the menu at one viewport point and associates the current context area as its source. */
	showAt(x: number, y: number, source?: HTMLElement): void {
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			throw new TypeError("Context menu coordinates must be finite numbers");
		}
		const popup = this.popup;
		if (!popup) {
			super.show(source ?? this.trigger ?? undefined);
			return;
		}
		popup.style.setProperty("--aui-context-menu-x", `${x}px`);
		popup.style.setProperty("--aui-context-menu-y", `${y}px`);
		super.show(source ?? this.trigger ?? undefined);
	}

	protected override connect(connection: AUIElement.Connection): void {
		super.connect(connection);
		this.#refreshContext();
		this.addEventListener("contextmenu", this.#onContextMenu, { signal: connection.signal });
		this.addEventListener("keydown", this.#onContextKeyDown, { signal: connection.signal });
		this.addEventListener("pointerdown", this.#onPointerDown, { signal: connection.signal });
		this.addEventListener("pointermove", this.#onPointerMove, { signal: connection.signal });
		this.addEventListener("pointerup", this.#cancelLongPress, { signal: connection.signal });
		this.addEventListener("pointercancel", this.#cancelLongPress, { signal: connection.signal });

		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refreshContext());
		observer.observe(this, {
			attributeFilter: ["id", "popover", "slot"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		connection.addCleanup(() => {
			observer.disconnect();
			this.#cancelLongPress();
			if (this.#contextTrigger) {
				this.#owner.release(this.#contextTrigger);
			}
		});
	}

	protected override beforeToggled(event: ToggleEvent): void {
		super.beforeToggled(event);
		const popup = this.popup;
		queueMicrotask(() => {
			if (popup === this.popup) {
				this.#synchronizeContextExpanded();
			}
		});
	}

	protected override toggled(event: ToggleEvent): void {
		super.toggled(event);
		this.#synchronizeContextExpanded();
	}

	#onContextMenu = (event: MouseEvent): void => {
		if (event.defaultPrevented) {
			return;
		}
		this.#refreshContext();
		const trigger = this.#contextTrigger;
		if (!trigger || !this.popup || !event.composedPath().includes(trigger)) {
			return;
		}
		this.#cancelLongPress();
		this.showAt(event.clientX, event.clientY, trigger);
		if (this.open) {
			event.preventDefault();
		}
	};

	#onContextKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented || (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10"))) {
			return;
		}
		this.#refreshContext();
		const trigger = this.#contextTrigger;
		if (!trigger || !this.popup || !event.composedPath().includes(trigger)) {
			return;
		}
		const target = isHTMLElement(event.target) ? event.target : trigger;
		const rect = target.getBoundingClientRect();
		const rtl = this.ownerDocument.defaultView?.getComputedStyle(target).direction === "rtl";
		this.showAt(rtl ? rect.right : rect.left, rect.bottom, trigger);
		if (this.open) {
			event.preventDefault();
		}
	};

	#onPointerDown = (event: PointerEvent): void => {
		if (event.pointerType !== "touch") {
			return;
		}
		if (event.defaultPrevented || !event.isPrimary) {
			this.#cancelLongPress();
			return;
		}
		this.#refreshContext();
		const trigger = this.#contextTrigger;
		if (!trigger || !this.popup || !event.composedPath().includes(trigger)) {
			return;
		}
		this.#cancelLongPress();
		const point = Object.freeze({ x: event.clientX, y: event.clientY });
		this.#longPressPointer = { id: event.pointerId, point, trigger };
		this.#longPressPopup = this.popup ?? undefined;
		this.#longPressTimer = setRealmTimeout(
			this,
			() => {
				this.#longPressTimer = undefined;
				const pending = this.#longPressPointer;
				const pendingPopup = this.#longPressPopup;
				this.#longPressPointer = undefined;
				this.#longPressPopup = undefined;
				this.#refreshContext();
				if (
					!pending ||
					!this.isConnected ||
					!pending.trigger.isConnected ||
					!this.contains(pending.trigger) ||
					pending.trigger !== this.#contextTrigger ||
					pendingPopup !== this.popup
				) {
					return;
				}
				this.showAt(pending.point.x, pending.point.y, pending.trigger);
			},
			500,
		);
	};

	#onPointerMove = (event: PointerEvent): void => {
		const pending = this.#longPressPointer;
		if (!pending || pending.id !== event.pointerId) {
			return;
		}
		if (Math.abs(event.clientX - pending.point.x) > 10 || Math.abs(event.clientY - pending.point.y) > 10) {
			this.#cancelLongPress();
		}
	};

	#cancelLongPress = (): void => {
		clearRealmTimeout(this.#longPressTimer);
		this.#longPressTimer = undefined;
		this.#longPressPointer = undefined;
		this.#longPressPopup = undefined;
	};

	#refreshContext(): void {
		const next = [...this.children].find(
			(child): child is HTMLElement => isHTMLElement(child) && child.getAttribute("slot") === "trigger",
		);
		const popup = this.popup ?? undefined;
		if ((next !== this.#contextTrigger || popup !== this.#longPressPopup) && this.#initializedContext) {
			this.#cancelLongPress();
		}
		if (next !== this.#contextTrigger && this.#initializedContext && this.open) {
			this.hide();
		}
		if (next !== this.#contextTrigger && this.#contextTrigger) {
			this.#owner.release(this.#contextTrigger);
		}
		this.#contextTrigger = next;
		const primaryTrigger = super.trigger;
		if (next && next !== primaryTrigger && popup?.id) {
			this.#owner.own(next, "aria-haspopup", "menu");
			this.#owner.own(next, "aria-controls", popup.id);
			this.#owner.own(next, "aria-expanded", String(popup.matches(":popover-open")));
		} else if (next && next !== primaryTrigger) {
			this.#owner.releaseAttribute(next, "aria-haspopup");
			this.#owner.releaseAttribute(next, "aria-controls");
			this.#owner.releaseAttribute(next, "aria-expanded");
		}
		this.#initializedContext = true;
	}

	#synchronizeContextExpanded(): void {
		const trigger = this.#contextTrigger;
		if (trigger && trigger !== super.trigger) {
			this.#owner.own(trigger, "aria-expanded", String(this.open));
		}
	}
}
