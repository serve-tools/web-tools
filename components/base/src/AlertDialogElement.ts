import { AttributeOwner } from "./_ownership.js";
import { BaseElement } from "./BaseElement.js";

const htmlNamespace = "http://www.w3.org/1999/xhtml";
const nonemptyAttribute = (element: Element, name: string): boolean => Boolean(element.getAttribute(name)?.trim());

/**
 * Exposes an author-owned native alert dialog only through modal operations.
 *
 * The current dialog's `role` is owned as `alertdialog` while selected and restored if the direct dialog is replaced.
 * `showModal()` requires authored nonempty label and description ARIA attributes, but does not compute an accessible name.
 */
export class AlertDialogElement extends BaseElement {
	#attributes = new AttributeOwner();
	#dialog: HTMLDialogElement | undefined;

	/** The first author-owned direct HTML dialog, if any. */
	get dialog(): HTMLDialogElement | null {
		this.#refresh();
		return this.#dialog ?? null;
	}

	/** Whether the current native dialog is open. A missing dialog reads as false. */
	get open(): boolean {
		return this.dialog?.open ?? false;
	}

	/** The current native dialog return value. A missing dialog reads as the empty string. */
	get returnValue(): string {
		return this.dialog?.returnValue ?? "";
	}

	/** Shows the current native dialog modally after checking authored ARIA relationship attributes. */
	showModal(): void {
		const dialog = this.#requireDialog();
		if (!nonemptyAttribute(dialog, "aria-label") && !nonemptyAttribute(dialog, "aria-labelledby")) {
			this.#throwState("AlertDialogElement requires aria-label or aria-labelledby on its direct dialog");
		}
		if (!nonemptyAttribute(dialog, "aria-description") && !nonemptyAttribute(dialog, "aria-describedby")) {
			this.#throwState("AlertDialogElement requires aria-description or aria-describedby on its direct dialog");
		}

		dialog.showModal();
	}

	/** Closes the current native dialog, optionally setting its return value. */
	close(returnValue?: string): void {
		this.#requireDialog().close(returnValue);
	}

	protected override connect(connection: BaseElement.Connection): void {
		this.#refresh();
		this.addEventListener("cancel", this.#onCancel, { capture: true, signal: connection.signal });
		this.addEventListener("close", this.#onClose, { capture: true, signal: connection.signal });

		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, { attributeFilter: ["role"], attributes: true, childList: true, subtree: true });
		connection.addCleanup(() => observer.disconnect());
	}

	#findDialog(): HTMLDialogElement | undefined {
		for (const child of this.children) {
			if (child.namespaceURI === htmlNamespace && child.localName === "dialog") {
				return child as HTMLDialogElement;
			}
		}

		return undefined;
	}

	#refresh(): void {
		const dialog = this.#findDialog();
		if (dialog !== this.#dialog) {
			if (this.#dialog) {
				this.#attributes.release(this.#dialog);
			}
			this.#dialog = dialog;
		}

		if (dialog) {
			this.#attributes.own(dialog, "role", "alertdialog");
		}
	}

	#requireDialog(): HTMLDialogElement {
		const dialog = this.dialog;
		if (dialog) {
			return dialog;
		}

		return this.#throwState("AlertDialogElement requires a direct child <dialog>");
	}

	#throwState(message: string): never {
		const Exception = this.ownerDocument.defaultView?.DOMException ?? DOMException;
		throw new Exception(message, "InvalidStateError");
	}

	#onCancel = (event: Event): void => {
		if (event.target !== this.#findDialog()) {
			return;
		}

		const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
		const forwarded = new EventConstructor("cancel", { cancelable: event.cancelable });
		if (!this.dispatchEvent(forwarded)) {
			event.preventDefault();
		}
	};

	#onClose = (event: Event): void => {
		if (event.target !== this.#findDialog()) {
			return;
		}

		const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
		this.dispatchEvent(new EventConstructor("close"));
	};
}
