import { upgradeProperty } from "./_upgrade.js";
import type { BaseElement } from "./BaseElement.js";
import { FormAssociatedElement } from "./FormAssociatedElement.js";

/** Immutable state proposed by a checked control's `beforechange` event. */
export interface CheckedChangeDetail {
	/** The checked state that will be committed unless the event is canceled. */
	readonly checked: boolean;

	/** The click shared by pointer, label, keyboard, and programmatic activation. */
	readonly sourceEvent: MouseEvent;
}

/** Optional transaction supplied by a checked control with an external state owner. */
export interface CheckedChangeTransaction {
	/** Commits the checked state and dispatches the source control's post-events. */
	complete(sourceEvent: MouseEvent, notify: () => void): void;

	/** Releases resources acquired before the proposal. */
	release(): void;
}

/** Concrete behavior that differs between checked-control families. */
export interface CheckedControlBehavior {
	readonly beginChange?: (
		element: CheckedControlElement,
		checked: boolean,
	) => CheckedChangeTransaction | false | undefined;
	readonly changeIsCurrent?: (
		element: CheckedControlElement,
		transaction: CheckedChangeTransaction | undefined,
	) => boolean;
	readonly synchronize: (
		element: CheckedControlElement,
		internals: ElementInternals,
		checked: boolean,
		effectiveDisabled: boolean,
	) => boolean;
}

/** Toggles one custom state. */
export const setCustomState = (internals: ElementInternals, state: string, present: boolean): void => {
	if (present) {
		internals.states.add(state);
	} else {
		internals.states.delete(state);
	}
};

const restoredStates = new Map<string, boolean>([
	["checked", true],
	["unchecked", false],
]);

const interactiveContentSelector =
	'a[href], audio[controls], button, details, embed, iframe, input, label, select, summary, textarea, video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]';

/** Private behavioral base shared by form-associated checkbox-like controls. */
export abstract class CheckedControlElement extends FormAssociatedElement {
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

	#additionalDisabled = false;
	#barredFromValidation = false;
	#behavior!: CheckedControlBehavior;
	#changing = false;
	#checked = this.hasAttribute("checked");
	#connectionSignal: AbortSignal | undefined;
	#dirtyCheckedness = false;
	#effectiveDisabled = this.hasAttribute("disabled");
	#enabledTabIndex: string | undefined;
	#focusInitialized = false;
	#interactionEpoch = 0;
	#platformDisabled = false;
	#settingTabIndex = false;
	#spacePressed = false;
	#valueMissingMessage = "";

	constructor() {
		super();

		this.addEventListener("click", this.#handleClick);
		this.addEventListener("blur", () => (this.#spacePressed = false));
		this.addEventListener("keydown", this.#handleKeyDown);
		this.addEventListener("keyup", this.#handleKeyUp);
	}

	/** Whether the control is currently checked. */
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

	/** The submitted value when checked. An absent value attribute represents `"on"`. */
	get value(): string {
		return this.getAttribute("value") ?? "on";
	}

	set value(value: string) {
		this.setAttribute("value", String(value));
	}

	/** The submitted value while unchecked, or `undefined` to omit the control from submission. */
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

	/** Whether direct, platform, or component-owned state currently disables this control. */
	protected get effectiveDisabled(): boolean {
		return this.#effectiveDisabled;
	}

	/** Whether this checked control participates in constraint validation. */
	override get willValidate(): boolean {
		return !this.#effectiveDisabled && super.willValidate;
	}

	/** Dispatches the same click activation used by pointer, label, and keyboard interaction. */
	override click(): void {
		if (this.#changing || this.#effectiveDisabled) {
			return;
		}
		super.click();
	}

	attributeChangedCallback(name: string, _previous: string | null, value: string | null): void {
		if (name === "name") {
			return;
		}
		if (name === "tabindex") {
			if (!this.#settingTabIndex) {
				if (this.#effectiveDisabled) {
					this.#enabledTabIndex = value ?? "0";
					this.#setTabIndex("-1");
				} else if (value === null) {
					this.#setTabIndex("0");
				}
			}
			return;
		}

		if (name === "checked" && !this.#dirtyCheckedness) {
			this.#checked = value !== null;
		} else if (name === "disabled") {
			this.#refreshEffectiveDisabled();
		}

		this.#synchronize();
	}

	formDisabledCallback(disabled: boolean): void {
		this.#platformDisabled = disabled;
		this.#refreshEffectiveDisabled();
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
		if (restored === undefined) {
			return;
		}

		this.#dirtyCheckedness = true;
		this.#checked = restored;
		this.#synchronize();
	}

	protected override connect(connection: BaseElement.Connection): void {
		this.#connectionSignal = connection.signal;

		if (!this.#focusInitialized) {
			this.#focusInitialized = true;

			if (this.#effectiveDisabled) {
				this.#enabledTabIndex ??= this.getAttribute("tabindex") ?? "0";
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

	/** Starts shared property recovery only after the concrete control has initialized its own state. */
	protected initializeCheckedControl(
		role: "checkbox" | "switch",
		valueMissingMessage: string,
		behavior: CheckedControlBehavior,
	): void {
		this.#behavior = behavior;
		this.#valueMissingMessage = valueMissingMessage;
		this.internals.role = role;

		for (const property of [
			"defaultChecked",
			"value",
			"uncheckedValue",
			"name",
			"disabled",
			"readOnly",
			"required",
			"checked",
		] as const) {
			upgradeProperty(this, property);
		}

		this.#setEffectiveDisabled(this.#platformDisabled || this.disabled || this.#additionalDisabled);
		this.#synchronize();
	}

	/** Marks checkedness dirty without changing it. */
	protected markCheckedDirty(): void {
		this.#dirtyCheckedness = true;
	}

	/** Updates component-owned disabledness without changing the authored attribute. */
	protected setAdditionalDisabled(disabled: boolean): void {
		this.#additionalDisabled = disabled;
		this.#refreshEffectiveDisabled();
	}

	#refreshEffectiveDisabled(): void {
		this.#setEffectiveDisabled(this.#platformDisabled || this.disabled || this.#additionalDisabled);
	}

	/** Updates checkedness silently, optionally making later checked-attribute changes default-only. */
	protected setChecked(checked: boolean, dirty = false): void {
		this.#setChecked(checked, dirty);
	}

	#setChecked(checked: boolean, dirty = false): void {
		if (dirty && this.#checked !== checked) {
			this.#dirtyCheckedness = true;
		}
		if (this.#checked === checked) {
			return;
		}

		this.#checked = checked;
		this.#synchronize();
	}

	/** Synchronizes state after a concrete control changes its own checked presentation. */
	protected synchronizeCheckedControl(): void {
		this.#synchronize();
	}

	/** Applies required and author-defined validity after construction. */
	protected override synchronizeValidity(): void {
		this.#synchronize();
	}

	#synchronize(): void {
		this.internals.ariaDisabled = String(this.#effectiveDisabled);
		this.internals.ariaReadOnly = String(this.readOnly);
		this.internals.ariaRequired = String(this.required);

		setCustomState(this.internals, "disabled", this.#effectiveDisabled);
		setCustomState(this.internals, "readonly", this.readOnly);

		this.#barredFromValidation = this.#behavior.synchronize(
			this,
			this.internals,
			this.#checked,
			this.#effectiveDisabled,
		);

		this.#synchronizeValidity();
	}

	#synchronizeValidity(): void {
		if (this.#barredFromValidation) {
			this.internals.setValidity({});
		} else if (super.customValidity) {
			super.synchronizeValidity();
		} else if (this.required && !this.#checked) {
			this.internals.setValidity({ valueMissing: true }, this.#valueMissingMessage);
		} else {
			this.internals.setValidity({});
		}
	}

	#dispatchChangeEvents(): void {
		const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
		this.dispatchEvent(new EventConstructor("input", { bubbles: true, composed: true }));
		this.dispatchEvent(new EventConstructor("change", { bubbles: true }));
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
		event.preventDefault();
		this.#proposeChange(event);
	};

	#proposeChange(sourceEvent: MouseEvent): void {
		if (this.#changing || this.#effectiveDisabled || this.readOnly) {
			return;
		}

		const checked = !this.#checked;
		const transaction = this.#behavior.beginChange?.(this, checked);
		if (transaction === false) {
			return;
		}

		this.#changing = true;
		try {
			const detail = Object.freeze({ checked, sourceEvent }) satisfies CheckedChangeDetail;
			const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
			const proposal = new EventConstructor<CheckedChangeDetail>("beforechange", {
				bubbles: true,
				cancelable: true,
				composed: true,
				detail,
			});

			if (
				!this.dispatchEvent(proposal) ||
				this.#effectiveDisabled ||
				this.readOnly ||
				this.#checked === checked ||
				(this.#behavior.changeIsCurrent && !this.#behavior.changeIsCurrent(this, transaction))
			) {
				return;
			}

			const notify = () => this.#dispatchChangeEvents();
			if (transaction) {
				transaction.complete(sourceEvent, notify);
			} else {
				this.#dirtyCheckedness = true;
				this.#checked = checked;
				this.#synchronize();
				notify();
			}
		} finally {
			transaction?.release();
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
		} else if (event.key === "Enter" && !this.#effectiveDisabled) {
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

	#setTabIndex(value: string): void {
		this.#settingTabIndex = true;
		try {
			this.setAttribute("tabindex", value);
		} finally {
			this.#settingTabIndex = false;
		}
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

const hasInteractiveTargetBeforeHost = (event: MouseEvent, host: HTMLElement): boolean => {
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
