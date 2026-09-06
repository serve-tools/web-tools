import { SelectionFieldElement } from "./_selection-field.js";

export type { SelectionChangeDetail, SelectionEventMap } from "./_selection-field.js";

const htmlNamespace = "http://www.w3.org/1999/xhtml";

const isButton = (element: Element): element is HTMLButtonElement =>
	element.namespaceURI === htmlNamespace && element.localName === "button";

/** A FACE custom select with one author-owned native button as its focus and activation identity. */
export class SelectElement extends SelectionFieldElement {
	protected control(): HTMLButtonElement | undefined {
		return [...this.children].find(isButton);
	}

	protected bindControl(control: HTMLButtonElement, signal: AbortSignal): void {
		control.addEventListener(
			"click",
			(event) => {
				if (!event.defaultPrevented && !this.effectiveDisabled && !this.effectiveReadOnly) {
					this.togglePopup(control);
				}
			},
			{ signal },
		);
		control.addEventListener(
			"keydown",
			(event) => {
				if (event.defaultPrevented || this.effectiveDisabled || this.effectiveReadOnly) {
					return;
				}
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					event.preventDefault();
					if (this.showPopup(control)) {
						this.moveActive(event.key === "ArrowDown" ? 1 : -1);
					}
				} else if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					if (!this.acceptActive(event)) {
						this.showPopup(control);
					}
				} else if (event.key === "Escape") {
					this.hidePopup();
				}
			},
			{ signal },
		);
	}

	protected configureControl(control: HTMLButtonElement): void {
		this.authoredControlAttribute(control, "type");
		this.ownControlAttribute(control, "type", "button");
	}
}
