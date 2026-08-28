import { HoverPopoverElement } from "./.hover-popover.js";
import { AttributeOwner } from "./.popover.js";
import type { AUIElement } from "./aui-element.js";

const defaultDelay = 600;
const defaultCloseDelay = 0;
let generatedTooltipId = 0;

const milliseconds = (value: string | null, fallback: number): number => {
	const number = Number(value);
	return value !== null && Number.isFinite(number) && number >= 0 ? number : fallback;
};

interface DescriptionOwnership {
	authorTokens: string[];
	owned: string;
	ownedId: string;
	trigger: HTMLElement;
}

interface CloseWatcher extends EventTarget {
	destroy(): void;
}

interface CloseWatcherConstructor {
	new (options?: { signal?: AbortSignal }): CloseWatcher;
}

interface CloseWatcherWindow extends Window {
	CloseWatcher?: CloseWatcherConstructor;
}

interface OwnedCloseWatcher {
	readonly controller: AbortController;
	readonly popup: HTMLElement;
	readonly watcher: CloseWatcher;
}

const tokens = (value: string | null): string[] => value?.split(/\s+/u).filter(Boolean) ?? [];

const elementById = (element: Element, id: string): Element | null => {
	const root = element.getRootNode();
	const getElementById = (root as Document | DocumentFragment).getElementById;
	return typeof getElementById === "function"
		? getElementById.call(root, id)
		: element.ownerDocument.getElementById(id);
};

/** A descriptive manual popover attached to an authored interactive trigger without moving focus. */
export class TooltipElement extends HoverPopoverElement {
	static readonly observedAttributes = ["close-delay", "delay"];

	#attributes = new AttributeOwner();
	#connection: AUIElement.Connection | undefined;
	#closeWatcher: OwnedCloseWatcher | undefined;
	#description: DescriptionOwnership | undefined;
	#ids = new WeakMap<HTMLElement, string>();
	#popup: HTMLElement | undefined;
	#refreshing = false;
	#trigger: HTMLElement | undefined;
	#triggerInitialized = false;

	constructor() {
		super();

		for (const property of ["closeDelay", "delay"] as const) {
			this.#upgradeProperty(property);
		}
	}

	/** The direct `slot="trigger"` element, or the first direct native interactive element. */
	get trigger(): HTMLElement | null {
		this.#refresh();
		return this.#trigger ?? null;
	}

	/** Delay before pointer hover opens the tooltip, in milliseconds. */
	get delay(): number {
		return milliseconds(this.getAttribute("delay"), defaultDelay);
	}

	set delay(value: number) {
		this.setAttribute("delay", String(value));
	}

	/** Delay before an unoccupied tooltip closes, in milliseconds. */
	get closeDelay(): number {
		return milliseconds(this.getAttribute("close-delay"), defaultCloseDelay);
	}

	set closeDelay(value: number) {
		this.setAttribute("close-delay", String(value));
	}

	/** Shows the tooltip after verifying that its current document realm supports native close requests. */
	override show(): void {
		const popup = this.requirePopup();
		this.#requireCloseWatcher();
		super.show();
		this.#acquireCloseWatcherIfOpen(popup);
	}

	/** Toggles the tooltip while requiring native close requests only when the operation opens it. */
	override toggle(source?: HTMLElement): boolean {
		const popup = this.requirePopup();
		if (!popup.matches(":popover-open")) {
			this.#requireCloseWatcher();
		}

		const open = super.toggle(source);
		if (open) {
			this.#acquireCloseWatcherIfOpen(popup);
		}
		return open;
	}

	protected override connect(connection: AUIElement.Connection): void {
		this.#connection = connection;
		connection.addCleanup(() => {
			if (this.#connection === connection) {
				this.#connection = undefined;
			}
			this.#destroyCloseWatcher();
		});
		super.connect(connection);
		this.#refresh();
		if (this.open) {
			this.#ensureCloseWatcher(this.requirePopup());
		}
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: ["aria-describedby", "href", "id", "popover", "role", "slot", "tabindex", "type"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		connection.addCleanup(() => observer.disconnect());
	}

	protected override moved(connection: AUIElement.Connection): void {
		if (this.#connection === connection) {
			this.#refresh();
		}
	}

	protected override beforeToggled(event: ToggleEvent): void {
		super.beforeToggled(event);
		if (event.newState === "closed") {
			this.#destroyCloseWatcher();
			return;
		}
		if (event.defaultPrevented) {
			return;
		}

		const popup = this.findPopup();
		const connection = this.#connection;
		if (!popup || !connection) {
			return;
		}

		try {
			this.#requireCloseWatcher();
		} catch (error) {
			event.preventDefault();
			throw error;
		}

		queueMicrotask(() => {
			this.#acquireCloseWatcherIfOpen(popup, connection);
		});
	}

	protected override toggled(event: ToggleEvent): void {
		super.toggled(event);
		if (event.newState === "closed") {
			this.#destroyCloseWatcher();
		} else {
			const popup = this.findPopup();
			const connection = this.#connection;
			if (popup && connection) {
				this.#acquireCloseWatcherIfOpen(popup, connection);
			}
		}
	}

	protected override showPopup(trigger: HTMLElement, popup: HTMLElement): void {
		this.#requireCloseWatcher();
		super.showPopup(trigger, popup);
		this.#acquireCloseWatcherIfOpen(popup);
	}

	#refresh(): void {
		if (this.#refreshing) {
			return;
		}
		this.#refreshing = true;

		try {
			const trigger = this.findTooltipTrigger();
			const popup = this.findPopup();
			const triggerChanged = this.#triggerInitialized && trigger !== this.#trigger;
			if (trigger !== this.#trigger) {
				if (this.#trigger) {
					this.#releaseDescription(this.#trigger);
					this.#attributes.release(this.#trigger);
				}
				this.#trigger = trigger;
			}
			this.#triggerInitialized = true;
			if (popup !== this.#popup) {
				this.#destroyCloseWatcher();
				if (this.#popup) {
					this.#attributes.release(this.#popup);
				}
				this.#popup = popup;
			}

			if (!popup) {
				if (trigger) {
					this.#releaseDescription(trigger);
				}
				return;
			}

			this.#attributes.own(popup, "popover", "manual");
			if (this.#attributes.authorValue(popup, "role") === null) {
				this.#attributes.own(popup, "role", "tooltip");
			} else {
				this.#attributes.releaseAttribute(popup, "role");
			}
			if (this.#attributes.authorValue(popup, "id") === null) {
				let id = this.#ids.get(popup);
				const existing = id ? elementById(popup, id) : null;
				if (!id || (existing && existing !== popup)) {
					do {
						id = `aui-tooltip-${++generatedTooltipId}`;
					} while (elementById(popup, id));
					this.#ids.set(popup, id);
				}
				this.#attributes.own(popup, "id", id);
			}

			if (!trigger || !popup.id) {
				if (trigger) {
					this.#releaseDescription(trigger);
				}
				return;
			}

			this.#ownDescription(trigger, popup.id);
			if (triggerChanged && popup.matches(":popover-open")) {
				this.hide();
			}
		} finally {
			this.#refreshing = false;
		}
	}

	#acquireCloseWatcherIfOpen(popup: HTMLElement, connection = this.#connection): void {
		if (
			!connection ||
			this.#connection !== connection ||
			!this.isConnected ||
			this.findPopup() !== popup ||
			!popup.matches(":popover-open")
		) {
			return;
		}

		try {
			this.#ensureCloseWatcher(popup);
		} catch (error) {
			if (this.#connection === connection && this.findPopup() === popup && popup.matches(":popover-open")) {
				this.hide();
			}
			throw error;
		}
	}

	#ensureCloseWatcher(popup: HTMLElement): void {
		if (this.#closeWatcher?.popup === popup) {
			return;
		}
		this.#destroyCloseWatcher();

		const Constructor = this.#requireCloseWatcher();
		const Controller = this.ownerDocument.defaultView?.AbortController ?? AbortController;
		const controller = new Controller();
		const watcher = new Constructor({ signal: controller.signal });
		this.#closeWatcher = { controller, popup, watcher };
		watcher.addEventListener(
			"close",
			() => {
				if (
					this.#closeWatcher?.watcher !== watcher ||
					this.popup !== popup ||
					!popup.matches(":popover-open")
				) {
					return;
				}
				this.hide();
			},
			{ signal: controller.signal },
		);
	}

	#destroyCloseWatcher(): void {
		const owned = this.#closeWatcher;
		this.#closeWatcher = undefined;
		owned?.controller.abort();
	}

	#requireCloseWatcher(): CloseWatcherConstructor {
		const Constructor = (this.ownerDocument.defaultView as CloseWatcherWindow | null)?.CloseWatcher;
		if (Constructor) {
			return Constructor;
		}

		const Exception = this.ownerDocument.defaultView?.DOMException ?? DOMException;
		throw new Exception("TooltipElement requires CloseWatcher support in its document realm", "NotSupportedError");
	}

	#ownDescription(trigger: HTMLElement, id: string): void {
		let ownership = this.#description;
		if (!ownership || ownership.trigger !== trigger) {
			ownership = {
				authorTokens: tokens(trigger.getAttribute("aria-describedby")),
				owned: trigger.getAttribute("aria-describedby") ?? "",
				ownedId: id,
				trigger,
			};
			this.#description = ownership;
		} else {
			const current = trigger.getAttribute("aria-describedby") ?? "";
			if (current !== ownership.owned) {
				const ownedId = ownership.ownedId;
				ownership.authorTokens = tokens(current).filter((token) => token !== ownedId);
			}
			ownership.ownedId = id;
		}

		const describedBy = [...ownership.authorTokens];
		if (!describedBy.includes(id)) {
			describedBy.push(id);
		}
		ownership.owned = describedBy.join(" ");
		if (trigger.getAttribute("aria-describedby") !== ownership.owned) {
			trigger.setAttribute("aria-describedby", ownership.owned);
		}
	}

	#releaseDescription(trigger: HTMLElement): void {
		const ownership = this.#description;
		if (!ownership || ownership.trigger !== trigger) {
			return;
		}

		const current = trigger.getAttribute("aria-describedby") ?? "";
		if (current !== ownership.owned) {
			ownership.authorTokens = tokens(current).filter((token) => token !== ownership.ownedId);
		}
		if (ownership.authorTokens.length === 0) {
			trigger.removeAttribute("aria-describedby");
		} else {
			trigger.setAttribute("aria-describedby", ownership.authorTokens.join(" "));
		}
		this.#description = undefined;
	}

	#upgradeProperty(property: "closeDelay" | "delay"): void {
		if (!Object.hasOwn(this, property)) {
			return;
		}
		const value = this[property];
		delete (this as Partial<Record<typeof property, unknown>>)[property];
		(this as Record<typeof property, unknown>)[property] = value;
	}
}
