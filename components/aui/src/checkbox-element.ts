import { AUIElement } from "./aui-element.js";

const restoredStates = new Map<string, readonly [checked: boolean, indeterminate: boolean]>([
	["checked", [true, false]],
	["unchecked", [false, false]],
	["checked/indeterminate", [true, true]],
	["unchecked/indeterminate", [false, true]],
]);

/** A form-associated checkbox whose host owns its interaction and accessible semantics. */
export class CheckboxElement extends AUIElement {
	static readonly formAssociated = true;
	static readonly observedAttributes = ["checked", "disabled", "name", "required", "tabindex", "value"];

	#checked = this.hasAttribute("checked");
	#customValidity = "";
	#dirtyCheckedness = false;
	#effectiveDisabled = this.hasAttribute("disabled");
	#enabledTabIndex: string | undefined;
	#focusInitialized = false;
	#indeterminate = false;
	#internals = this.attachInternals();
	#platformDisabled = false;
	#programmaticClickEvent: MouseEvent | undefined;
	#programmaticClickInProgress = false;
	#settingTabIndex = false;
	#spacePressed = false;

	constructor() {
		super();

		this.#internals.role = "checkbox";
		this.addEventListener("click", this.#handleClick);
		this.addEventListener("blur", () => (this.#spacePressed = false));
		this.addEventListener("keydown", this.#handleKeyDown);
		this.addEventListener("keyup", this.#handleKeyUp);

		for (const property of ["defaultChecked", "value", "name", "disabled", "required"] as const) {
			this.#upgradeProperty(property);
		}
		for (const property of ["checked", "indeterminate"] as const) {
			this.#upgradeProperty(property);
		}

		this.#synchronize();
	}

	/** Whether the checkbox is currently checked. */
	get checked(): boolean {
		return this.#checked;
	}

	set checked(value: boolean) {
		this.#dirtyCheckedness = true;
		this.#setChecked(Boolean(value));
	}

	/** Whether checkedness defaults to true when the form is reset. */
	get defaultChecked(): boolean {
		return this.hasAttribute("checked");
	}

	set defaultChecked(value: boolean) {
		this.toggleAttribute("checked", Boolean(value));
	}

	/** Whether the checkbox presents a mixed state without changing form submission. */
	get indeterminate(): boolean {
		return this.#indeterminate;
	}

	set indeterminate(value: boolean) {
		this.#setIndeterminate(Boolean(value));
	}

	/** The submitted value when checked. An absent value attribute represents `"on"`. */
	get value(): string {
		return this.getAttribute("value") ?? "on";
	}

	set value(value: string) {
		this.setAttribute("value", String(value));
	}

	/** The form-entry name. */
	get name(): string {
		return this.getAttribute("name") ?? "";
	}

	set name(value: string) {
		this.setAttribute("name", String(value));
	}

	/** Whether the checkbox is disabled directly. Disabled fieldsets are reflected through form association. */
	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	/** Whether checkedness is required for constraint validation. */
	get required(): boolean {
		return this.hasAttribute("required");
	}

	set required(value: boolean) {
		this.toggleAttribute("required", Boolean(value));
	}

	/** The associated form, if any. */
	get form(): HTMLFormElement | null {
		return this.#internals.form;
	}

	/** Labels associated with this checkbox in its tree. */
	get labels(): NodeList {
		return this.#internals.labels;
	}

	/** The current constraint-validation state. */
	get validity(): ValidityState {
		return this.#internals.validity;
	}

	/** The current constraint-validation message. */
	get validationMessage(): string {
		return this.#internals.validationMessage;
	}

	/** Whether this checkbox participates in constraint validation. */
	get willValidate(): boolean {
		return this.#internals.willValidate;
	}

	/** Runs constraint validation and dispatches `invalid` when invalid. */
	checkValidity(): boolean {
		return this.#internals.checkValidity();
	}

	/** Runs interactive constraint validation. */
	reportValidity(): boolean {
		return this.#internals.reportValidity();
	}

	/** Replaces the author-defined validation error. */
	setCustomValidity(message: string): void {
		this.#customValidity = String(message);
		this.#synchronizeValidity();
	}

	/** Performs script activation unless the checkbox is effectively disabled. */
	override click(): void {
		if (this.#effectiveDisabled || this.#programmaticClickInProgress) {
			return;
		}

		const previousChecked = this.#checked;
		const previousIndeterminate = this.#indeterminate;
		this.#preactivate();
		this.#programmaticClickEvent = undefined;
		this.#programmaticClickInProgress = true;

		try {
			super.click();
		} finally {
			this.#programmaticClickInProgress = false;
		}

		const clickEvent = this.#programmaticClickEvent as MouseEvent | undefined;
		if (clickEvent?.defaultPrevented) {
			this.#checked = previousChecked;
			this.#indeterminate = previousIndeterminate;
			this.#synchronize();
		} else {
			this.#dispatchChangeEvents();
		}
	}

	attributeChangedCallback(name: string, _previous: string | null, value: string | null): void {
		if (name === "checked" && !this.#dirtyCheckedness) {
			this.#checked = value !== null;
		} else if (name === "disabled") {
			this.#setEffectiveDisabled(value !== null || this.#platformDisabled);
		} else if (name === "tabindex" && !this.#settingTabIndex) {
			if (this.#effectiveDisabled) {
				this.#enabledTabIndex = value ?? "0";
				this.#setTabIndex("-1");
			} else if (value === null) {
				this.#setTabIndex("0");
			}
		}

		this.#synchronize();
	}

	formDisabledCallback(disabled: boolean): void {
		this.#platformDisabled = disabled;
		this.#setEffectiveDisabled(disabled || this.disabled);
	}

	formResetCallback(): void {
		this.#dirtyCheckedness = false;
		this.#setChecked(this.defaultChecked);
	}

	formStateRestoreCallback(state: File | FormData | string | null, _mode: "autocomplete" | "restore"): void {
		if (typeof state !== "string") {
			return;
		}
		const restored = restoredStates.get(state);
		if (!restored) {
			return;
		}

		this.#dirtyCheckedness = true;
		this.#checked = restored[0];
		this.#indeterminate = restored[1];
		this.#synchronize();
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout(content: DocumentFragment): void {
		const control = this.ownerDocument.createElement("span");
		control.setAttribute("part", "control");
		control.setAttribute("aria-hidden", "true");

		const indicator = this.ownerDocument.createElement("slot");
		indicator.name = "indicator";
		control.append(indicator);

		content.append(control, this.ownerDocument.createElement("slot"));
	}

	protected override connect(connection: AUIElement.Connection): void {
		if (!this.#focusInitialized) {
			this.#focusInitialized = true;

			if (this.#effectiveDisabled) {
				this.#enabledTabIndex = this.getAttribute("tabindex") ?? "0";
				this.#setTabIndex("-1");
			} else if (!this.hasAttribute("tabindex")) {
				this.#setTabIndex("0");
			}
		}

		connection.addCleanup(() => (this.#spacePressed = false));
	}

	#dispatchChangeEvents(): void {
		this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
		this.dispatchEvent(new Event("change", { bubbles: true }));
	}

	#handleClick = (event: MouseEvent): void => {
		if (this.#programmaticClickInProgress) {
			this.#programmaticClickEvent = event;
			return;
		}
		if (event.defaultPrevented || this.#effectiveDisabled) {
			return;
		}

		this.#preactivate();
		this.#dispatchChangeEvents();
	};

	#handleKeyDown = (event: KeyboardEvent): void => {
		if (event.target !== this || event.key !== " " || this.#effectiveDisabled) {
			return;
		}
		event.preventDefault();
		if (!event.repeat) {
			this.#spacePressed = true;
		}
	};

	#handleKeyUp = (event: KeyboardEvent): void => {
		if (event.target !== this || event.key !== " " || !this.#spacePressed) {
			return;
		}
		event.preventDefault();
		this.#spacePressed = false;
		this.click();
	};

	#preactivate(): void {
		this.#dirtyCheckedness = true;
		this.#checked = !this.#checked;
		this.#indeterminate = false;
		this.#synchronize();
	}

	#setChecked(value: boolean): void {
		if (this.#checked === value) {
			return;
		}
		this.#checked = value;
		this.#synchronize();
	}

	#setEffectiveDisabled(value: boolean): void {
		if (this.#effectiveDisabled === value) {
			return;
		}
		this.#effectiveDisabled = value;

		if (!this.#focusInitialized) {
			this.#synchronize();
			return;
		}

		if (value) {
			this.#spacePressed = false;
			this.#enabledTabIndex = this.getAttribute("tabindex") ?? "0";
			this.#setTabIndex("-1");
		} else {
			this.#setTabIndex(this.#enabledTabIndex ?? "0");
			this.#enabledTabIndex = undefined;
		}

		this.#synchronize();
	}

	#setIndeterminate(value: boolean): void {
		if (this.#indeterminate === value) {
			return;
		}
		this.#indeterminate = value;
		this.#synchronize();
	}

	#setTabIndex(value: string): void {
		this.#settingTabIndex = true;
		try {
			this.setAttribute("tabindex", value);
		} finally {
			this.#settingTabIndex = false;
		}
	}

	#synchronize(): void {
		this.#internals.ariaChecked = this.#indeterminate ? "mixed" : String(this.#checked);
		this.#internals.ariaDisabled = String(this.#effectiveDisabled);
		this.#internals.ariaRequired = String(this.required);

		this.#setState("checked", this.#checked);
		this.#setState("indeterminate", this.#indeterminate);
		this.#setState("disabled", this.#effectiveDisabled);

		const state = this.#checked
			? this.#indeterminate
				? "checked/indeterminate"
				: "checked"
			: this.#indeterminate
				? "unchecked/indeterminate"
				: "unchecked";
		this.#internals.setFormValue(this.#checked ? this.value : null, state);
		this.#synchronizeValidity();
	}

	#synchronizeValidity(): void {
		if (this.#customValidity) {
			this.#internals.setValidity({ customError: true }, this.#customValidity);
		} else if (this.required && !this.#checked) {
			this.#internals.setValidity({ valueMissing: true }, "Please check this box.");
		} else {
			this.#internals.setValidity({});
		}
	}

	#setState(state: string, present: boolean): void {
		if (present) {
			this.#internals.states.add(state);
		} else {
			this.#internals.states.delete(state);
		}
	}

	#upgradeProperty(
		property: "checked" | "defaultChecked" | "disabled" | "indeterminate" | "name" | "required" | "value",
	): void {
		if (!Object.hasOwn(this, property)) {
			return;
		}
		const value = this[property];
		delete (this as Partial<Record<typeof property, unknown>>)[property];
		(this as Record<typeof property, unknown>)[property] = value;
	}
}
