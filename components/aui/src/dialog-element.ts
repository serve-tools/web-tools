import { AUIElement } from "./aui-element.js";

const htmlNamespace = "http://www.w3.org/1999/xhtml";

/**
 * Exposes an author-owned direct child `<dialog>` without replacing its native behavior.
 *
 * The first direct HTML dialog child is current. Read-only state is neutral while it is absent, and methods that
 * require it throw `InvalidStateError`. Replacing or adding the child takes effect without reconnecting the host.
 */
export class DialogElement extends AUIElement {
	/** The first author-owned direct child HTML dialog, if any. */
	get dialog(): HTMLDialogElement | null {
		return this.#findDialog() ?? null;
	}

	/** Whether the current native dialog is open. A missing dialog reads as false. */
	get open(): boolean {
		return this.dialog?.open ?? false;
	}

	/** The current native dialog return value. A missing dialog reads as the empty string. */
	get returnValue(): string {
		return this.dialog?.returnValue ?? "";
	}

	/** Shows the current native dialog non-modally. */
	show(): void {
		this.#requireDialog().show();
	}

	/** Shows the current native dialog modally. */
	showModal(): void {
		this.#requireDialog().showModal();
	}

	/** Closes the current native dialog, optionally setting its return value. */
	close(returnValue?: string): void {
		this.#requireDialog().close(returnValue);
	}

	protected override connect(connection: AUIElement.Connection): void {
		this.addEventListener("cancel", this.#onCancel, { capture: true, signal: connection.signal });
		this.addEventListener("close", this.#onClose, { capture: true, signal: connection.signal });
	}

	#findDialog(): HTMLDialogElement | undefined {
		for (const child of this.children) {
			if (child.namespaceURI === htmlNamespace && child.localName === "dialog") {
				return child as HTMLDialogElement;
			}
		}

		return undefined;
	}

	#requireDialog(): HTMLDialogElement {
		const dialog = this.dialog;
		if (dialog) {
			return dialog;
		}

		const Exception = this.ownerDocument.defaultView?.DOMException ?? DOMException;
		throw new Exception("DialogElement requires a direct child <dialog>", "InvalidStateError");
	}

	#onCancel = (event: Event): void => {
		if (event.target !== this.#findDialog()) {
			return;
		}

		const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
		const forwarded = new EventConstructor("cancel", { cancelable: true });
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
