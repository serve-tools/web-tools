import { AUIElement } from "./aui-element.js";

/** Immutable state proposed by a checkbox's `beforechange` event. */
export interface CheckboxChangeDetail {
	/** The checked state that will be committed unless the event is canceled. */
	readonly checked: boolean;

	/** The click shared by pointer, label, keyboard, and programmatic activation. */
	readonly sourceEvent: MouseEvent;
}

/** Events emitted by a checkbox element. */
export interface CheckboxEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<CheckboxChangeDetail>;
}

const restoredStates = new Map<string, readonly [checked: boolean, indeterminate: boolean]>([
	["checked", [true, false]],
	["unchecked", [false, false]],
	["checked/indeterminate", [true, true]],
	["unchecked/indeterminate", [false, true]],
]);

const interactiveContentSelector =
	'a[href], audio[controls], button, details, embed, iframe, input, label, select, summary, textarea, video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]';

/** A form-associated checkbox whose host owns its interaction and accessible semantics. */
export class CheckboxElement extends AUIElement {
	static readonly formAssociated = true;
	static readonly observedAttributes = [
		"checked",
		"disabled",
		"name",
		"readonly",
		"required",
		"tabindex",
		"unchecked-value",
		"value",
	];

	#changing = false;
	#checked = this.hasAttribute("checked");
	#connectionSignal: AbortSignal | undefined;
	#customValidity = "";
	#dirtyCheckedness = false;
	#effectiveDisabled = this.hasAttribute("disabled");
	#enabledTabIndex: string | undefined;
	#focusInitialized = false;
	#indeterminate = false;
	#internals = this.attachInternals();
	#interactionEpoch = 0;
	#platformDisabled = false;
	#settingTabIndex = false;
	#spacePressed = false;

	declare addEventListener: {
		<Type extends keyof CheckboxEventMap>(
			type: Type,
			listener: (this: CheckboxElement, event: CheckboxEventMap[Type]) => unknown,
			options?: boolean | AddEventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | AddEventListenerOptions,
		): void;
	};

	declare removeEventListener: {
		<Type extends keyof CheckboxEventMap>(
			type: Type,
			listener: (this: CheckboxElement, event: CheckboxEventMap[Type]) => unknown,
			options?: boolean | EventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | EventListenerOptions,
		): void;
	};

	constructor() {
		super();

		this.#internals.role = "checkbox";
		this.addEventListener("click", this.#handleClick);
		this.addEventListener("blur", () => (this.#spacePressed = false));
		this.addEventListener("keydown", this.#handleKeyDown);
		this.addEventListener("keyup", this.#handleKeyUp);

		for (const property of [
			"defaultChecked",
			"value",
			"uncheckedValue",
			"name",
			"disabled",
			"readOnly",
			"required",
		] as const) {
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

	/** The submitted value while unchecked, or `undefined` to omit the checkbox from submission. */
	get uncheckedValue(): string | undefined {
		return this.getAttribute("unchecked-value") ?? undefined;
	}

	set uncheckedValue(value: string | undefined) {
		if (value === undefined) {
			this.removeAttribute("unchecked-value");
		} else {
			this.setAttribute("unchecked-value", String(value));
		}
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

	/** Whether user interaction may propose a checked-state change. */
	get readOnly(): boolean {
		return this.hasAttribute("readonly");
	}

	set readOnly(value: boolean) {
		this.toggleAttribute("readonly", Boolean(value));
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

	/** Dispatches the same click activation used by pointer, label, and keyboard interaction. */
	override click(): void {
		if (this.#changing || this.#effectiveDisabled) {
			return;
		}
		super.click();
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

	formAssociatedCallback(_form: HTMLFormElement | null): void {
		++this.#interactionEpoch;
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
		this.#connectionSignal = connection.signal;

		if (!this.#focusInitialized) {
			this.#focusInitialized = true;

			if (this.#effectiveDisabled) {
				this.#enabledTabIndex = this.getAttribute("tabindex") ?? "0";
				this.#setTabIndex("-1");
			} else if (!this.hasAttribute("tabindex")) {
				this.#setTabIndex("0");
			}
		}

		connection.addCleanup(() => {
			if (this.#connectionSignal === connection.signal) {
				this.#connectionSignal = undefined;
			}
			this.#spacePressed = false;
		});
	}

	#dispatchChangeEvents(): void {
		this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
		this.dispatchEvent(new Event("change", { bubbles: true }));
	}

	#handleClick = (event: MouseEvent): void => {
		if (
			event.defaultPrevented ||
			this.#effectiveDisabled ||
			this.readOnly ||
			hasInteractiveTargetBeforeHost(event, this)
		) {
			return;
		}
		this.#proposeChange(event);
	};

	#proposeChange(sourceEvent: MouseEvent): void {
		if (this.#changing || this.#effectiveDisabled || this.readOnly) {
			return;
		}

		this.#changing = true;
		try {
			const checked = !this.#checked;
			const detail = Object.freeze({ checked, sourceEvent }) satisfies CheckboxChangeDetail;
			const proposal = new CustomEvent<CheckboxChangeDetail>("beforechange", {
				bubbles: true,
				cancelable: true,
				composed: true,
				detail,
			});

			if (!this.dispatchEvent(proposal) || this.#effectiveDisabled || this.readOnly) {
				return;
			}

			this.#dirtyCheckedness = true;
			this.#checked = checked;
			this.#synchronize();
			this.#dispatchChangeEvents();
		} finally {
			this.#changing = false;
		}
	}

	#handleKeyDown = (event: KeyboardEvent): void => {
		if (event.target !== this || event.defaultPrevented) {
			return;
		}

		if (event.key === " ") {
			if (this.#effectiveDisabled || this.readOnly) {
				return;
			}
			event.preventDefault();
			if (!event.repeat) {
				this.#spacePressed = true;
			}
		} else if (event.key === "Enter") {
			if (this.#effectiveDisabled) {
				return;
			}
			this.#scheduleEnterSubmission(event);
		}
	};

	#handleKeyUp = (event: KeyboardEvent): void => {
		if (event.target !== this || event.key !== " ") {
			return;
		}
		const spacePressed = this.#spacePressed;
		this.#spacePressed = false;
		if (event.defaultPrevented || !spacePressed || this.#effectiveDisabled || this.readOnly) {
			return;
		}
		event.preventDefault();

		const MouseEventConstructor = this.ownerDocument.defaultView?.MouseEvent ?? MouseEvent;
		this.dispatchEvent(
			new MouseEventConstructor("click", {
				altKey: event.altKey,
				bubbles: true,
				cancelable: true,
				composed: true,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				shiftKey: event.shiftKey,
			}),
		);
	};

	#scheduleEnterSubmission(event: KeyboardEvent): void {
		const connectionSignal = this.#connectionSignal;
		const document = this.ownerDocument;
		const form = this.form;
		const interactionEpoch = this.#interactionEpoch;
		if (!connectionSignal || !form) {
			return;
		}

		queueMicrotask(() => {
			if (
				event.defaultPrevented ||
				connectionSignal.aborted ||
				!this.isConnected ||
				this.#effectiveDisabled ||
				this.#interactionEpoch !== interactionEpoch ||
				this.ownerDocument !== document ||
				this.form !== form
			) {
				return;
			}

			getDefaultFormSubmitter(form)?.click();
		});
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
		++this.#interactionEpoch;
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
		this.#internals.ariaReadOnly = String(this.readOnly);
		this.#internals.ariaRequired = String(this.required);

		this.#setState("checked", this.#checked);
		this.#setState("indeterminate", this.#indeterminate);
		this.#setState("disabled", this.#effectiveDisabled);
		this.#setState("readonly", this.readOnly);

		const state = this.#checked
			? this.#indeterminate
				? "checked/indeterminate"
				: "checked"
			: this.#indeterminate
				? "unchecked/indeterminate"
				: "unchecked";
		this.#internals.setFormValue(this.#checked ? this.value : (this.uncheckedValue ?? null), state);
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
		property:
			| "checked"
			| "defaultChecked"
			| "disabled"
			| "indeterminate"
			| "name"
			| "readOnly"
			| "required"
			| "uncheckedValue"
			| "value",
	): void {
		if (!Object.hasOwn(this, property)) {
			return;
		}
		const value = this[property];
		delete (this as Partial<Record<typeof property, unknown>>)[property];
		(this as Record<typeof property, unknown>)[property] = value;
	}
}

const getDefaultFormSubmitter = (form: HTMLFormElement): HTMLButtonElement | HTMLInputElement | undefined => {
	for (const element of form.elements) {
		if (element.localName === "button") {
			const button = element as HTMLButtonElement;
			if (button.form === form && button.type === "submit") {
				return button;
			}
		} else if (element.localName === "input") {
			const input = element as HTMLInputElement;
			if (input.form === form && input.type === "submit") {
				return input;
			}
		}
	}

	return undefined;
};

const hasInteractiveTargetBeforeHost = (event: MouseEvent, host: CheckboxElement): boolean => {
	for (const target of event.composedPath()) {
		if (target === host) {
			return false;
		}
		if (
			typeof (target as Element).matches === "function" &&
			(target as Element).matches(interactiveContentSelector)
		) {
			return true;
		}
	}

	return false;
};
