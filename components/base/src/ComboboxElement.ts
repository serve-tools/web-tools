import { SelectionFieldElement } from "./_selection-field.js";

export type { SelectionChangeDetail, SelectionEventMap } from "./_selection-field.js";

const htmlNamespace = "http://www.w3.org/1999/xhtml";

const isInput = (element: Element): element is HTMLInputElement =>
	element.namespaceURI === htmlNamespace && element.localName === "input";

/** A FACE selectable collection with one author-owned native text input as its focus identity. */
export class ComboboxElement extends SelectionFieldElement {
	protected control(): HTMLInputElement | undefined {
		return [...this.children].find(isInput);
	}

	protected bindControl(control: HTMLInputElement, signal: AbortSignal): void {
		let composing = false;
		control.addEventListener("compositionstart", () => (composing = true), { signal });
		control.addEventListener("compositionend", () => (composing = false), { signal });
		control.addEventListener(
			"keydown",
			(event) => {
				if (
					event.defaultPrevented ||
					composing ||
					event.isComposing ||
					event.keyCode === 229 ||
					this.effectiveDisabled ||
					this.effectiveReadOnly
				) {
					return;
				}
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					event.preventDefault();
					if (this.showPopup(control)) {
						this.moveActive(event.key === "ArrowDown" ? 1 : -1);
					}
				} else if (event.key === "Enter") {
					if (this.acceptActive(event)) {
						event.preventDefault();
					}
				} else if (event.key === "Escape") {
					this.hidePopup();
				}
			},
			{ signal },
		);
		control.addEventListener(
			"input",
			() => {
				if (!composing && control.value && !this.effectiveDisabled && !this.effectiveReadOnly) {
					this.showPopup(control);
				}
			},
			{ signal },
		);
	}

	protected configureControl(control: HTMLInputElement): void {
		this.authoredControlAttribute(control, "name");
		this.ownControlAttribute(control, "name", null);
		this.ownControlAttribute(control, "readonly", this.effectiveReadOnly ? "" : null);
		this.ownControlAttribute(control, "aria-autocomplete", "list");
	}

	protected controlHasAuthoredReadOnly(control: HTMLInputElement): boolean {
		return this.authoredControlAttribute(control, "readonly") !== null;
	}
}
