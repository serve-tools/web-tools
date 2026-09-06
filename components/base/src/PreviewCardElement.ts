import { HoverPopoverElement } from "./_hover-popover.js";
import { AttributeOwner } from "./_ownership.js";
import { upgradeProperty } from "./_upgrade.js";
import type { BaseElement } from "./BaseElement.js";

const defaultDelay = 600;
const defaultCloseDelay = 300;

const milliseconds = (value: string | null, fallback: number): number => {
	const number = Number(value);
	return value !== null && Number.isFinite(number) && number >= 0 ? number : fallback;
};

/** An authored link with an interactive auto popover kept open across trigger and popup occupancy. */
export class PreviewCardElement extends HoverPopoverElement {
	static readonly observedAttributes = ["close-delay", "delay"];

	#attributes = new AttributeOwner();
	#popup: HTMLElement | undefined;
	#refreshing = false;
	#trigger: HTMLAnchorElement | undefined;
	#triggerInitialized = false;

	constructor() {
		super();

		for (const property of ["closeDelay", "delay"] as const) {
			upgradeProperty(this, property);
		}
	}

	/** The direct `slot="trigger"` link, or the first direct authored link with an `href`. */
	get trigger(): HTMLAnchorElement | null {
		this.#refresh();
		return this.#trigger ?? null;
	}

	/** Delay before pointer hover opens the preview card, in milliseconds. */
	get delay(): number {
		return milliseconds(this.getAttribute("delay"), defaultDelay);
	}

	set delay(value: number) {
		this.setAttribute("delay", String(value));
	}

	/** Grace period before an unoccupied preview card closes, in milliseconds. */
	get closeDelay(): number {
		return milliseconds(this.getAttribute("close-delay"), defaultCloseDelay);
	}

	set closeDelay(value: number) {
		this.setAttribute("close-delay", String(value));
	}

	protected override connect(connection: BaseElement.Connection): void {
		super.connect(connection);
		this.#refresh();
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: ["href", "popover", "slot"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		connection.addCleanup(() => observer.disconnect());
	}

	#refresh(): void {
		if (this.#refreshing) {
			return;
		}
		this.#refreshing = true;

		try {
			const trigger = this.findLinkTrigger();
			const popup = this.findPopup();
			const triggerChanged = this.#triggerInitialized && trigger !== this.#trigger;
			if (trigger !== this.#trigger) {
				if (this.#trigger) {
					this.#attributes.release(this.#trigger);
				}
				this.#trigger = trigger;
			}
			this.#triggerInitialized = true;
			if (popup !== this.#popup) {
				if (this.#popup) {
					this.#attributes.release(this.#popup);
				}
				this.#popup = popup;
			}

			if (popup) {
				this.#attributes.own(popup, "popover", "auto");
			}
			if (triggerChanged && popup?.matches(":popover-open")) {
				this.hide();
			}
		} finally {
			this.#refreshing = false;
		}
	}
}
