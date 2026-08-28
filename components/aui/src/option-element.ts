import { AttributeOwner } from "./.popover.js";
import { notifySelectionOwner, ownSelectionId, setOwnedOptionSelected } from "./.selection.js";
import { AUIElement } from "./aui-element.js";

/** A string-identified authored option in an AUI selection collection. */
export class OptionElement extends AUIElement {
	static readonly observedAttributes = ["disabled", "label", "selected", "value"];

	#active = false;
	#attributes = new AttributeOwner();
	#invalid = false;
	#selected = this.hasAttribute("selected");

	constructor() {
		super();

		for (const property of ["value", "label", "disabled", "defaultSelected", "selected"] as const) {
			this.#upgrade(property);
		}
	}

	protected connect(): void {
		this.#synchronize();
	}

	/** The explicit string identity used by a selection owner. Empty strings are valid. */
	get value(): string {
		if (!this.hasAttribute("value")) {
			throw new TypeError("An AUI option requires an explicit value attribute");
		}
		return this.getAttribute("value")!;
	}

	set value(value: string) {
		this.setAttribute("value", String(value));
	}

	/** Matching, acceptance, and accessible text, falling back to authored text content. */
	get label(): string {
		return this.getAttribute("label") ?? this.textContent ?? "";
	}

	set label(value: string) {
		this.setAttribute("label", String(value));
	}

	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	/** Current selectedness. A current owner coordinates this write silently. */
	get selected(): boolean {
		return this.#selected;
	}

	set selected(value: boolean) {
		const selected = Boolean(value);
		if (!setOwnedOptionSelected(this, selected)) {
			this.#selected = selected;
			this.#synchronize();
		}
	}

	/** The selectedness default consulted by the owning FACE field on form reset. */
	get defaultSelected(): boolean {
		return this.hasAttribute("selected");
	}

	set defaultSelected(value: boolean) {
		this.toggleAttribute("selected", Boolean(value));
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
		if (name === "selected") {
			this.#selected = value !== null;
		}
		this.#synchronize();
		notifySelectionOwner(this);
	}

	/** @internal Updates the semantics assigned by the nearest listbox owner. */
	setListboxState(active: boolean, selected: boolean, invalid = false): void {
		this.#active = active;
		this.#selected = selected;
		this.#invalid = invalid;
		this.#synchronize();
	}

	/** @internal Returns an owned option ID that is unique in the current document. */
	ensureListboxId(): string {
		return ownSelectionId(this.#attributes, this, "aui-option");
	}

	#synchronize(): void {
		this.#attributes.own(this, "role", "option");
		this.#attributes.own(this, "aria-selected", String(this.#selected));
		this.#attributes.own(this, "aria-disabled", String(this.disabled || this.#invalid));
		if (this.hasAttribute("label")) {
			this.#attributes.own(this, "aria-label", this.label);
		} else {
			this.#attributes.releaseAttribute(this, "aria-label");
		}
		this.toggleAttribute("data-active", this.#active);
		this.toggleAttribute("data-selected", this.#selected);
		this.toggleAttribute("data-disabled", this.disabled || this.#invalid);
	}

	#upgrade(property: "defaultSelected" | "disabled" | "label" | "selected" | "value"): void {
		if (!Object.hasOwn(this, property)) {
			return;
		}
		const value = this[property];
		delete (this as Partial<Record<typeof property, unknown>>)[property];
		(this as Record<typeof property, unknown>)[property] = value;
	}
}
