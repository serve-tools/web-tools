import type { CheckboxGroupController, CheckboxHandle } from "./.checkbox-group.js";
import { getCheckboxGroup, getDirectCheckboxGroup, registerCheckbox } from "./.checkbox-group.js";
import type { CheckedChangeDetail, CheckedControlBehavior } from "./.checked-control.js";
import { CheckedControlElement, setCustomState } from "./.checked-control.js";
import { upgradeProperty } from "./.upgrade.js";
import type { AUIElement } from "./aui-element.js";
import { html } from "./template.js";

/** Immutable state proposed by a checkbox's `beforechange` event. */
export interface CheckboxChangeDetail extends CheckedChangeDetail {}

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

/** A form-associated checkbox whose host owns its interaction and accessible semantics. */
export class CheckboxElement extends CheckedControlElement {
	static readonly observedAttributes = [...CheckedControlElement.observedAttributes, "parent"];
	static readonly #behavior = Object.freeze<CheckedControlBehavior>({
		beginChange: (element, checked) => {
			const checkbox = element as CheckboxElement;
			const group = checkbox.#reconcileGroup();
			const lease = group?.begin(checkbox.#handle, checked);
			return group && !lease ? false : lease;
		},
		changeIsCurrent: (element, transaction) =>
			transaction !== undefined || (element as CheckboxElement).#reconcileGroup() === undefined,
		synchronize: (element, internals, checked, effectiveDisabled) => {
			const checkbox = element as CheckboxElement;
			const indeterminate = checkbox.#indeterminate;
			internals.ariaChecked = indeterminate ? "mixed" : String(checked);
			setCustomState(internals, "checked", checked);
			setCustomState(internals, "indeterminate", indeterminate);

			const state = checked
				? indeterminate
					? "checked/indeterminate"
					: "checked"
				: indeterminate
					? "unchecked/indeterminate"
					: "unchecked";
			internals.setFormValue(
				effectiveDisabled || checkbox.parent
					? null
					: checked
						? checkbox.value
						: (checkbox.uncheckedValue ?? null),
				state,
			);
			return checkbox.#groupDisabled || checkbox.parent;
		},
	});

	readonly #handle: CheckboxHandle;
	#group: CheckboxGroupController | undefined;
	#groupDisabled = false;
	#indeterminate = false;

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

		const element = this;
		this.#handle = {
			element: this,
			get checked() {
				return element.#getChecked();
			},
			get disabled() {
				return element.#getEffectiveDisabled();
			},
			get hasValue() {
				return element.hasAttribute("value");
			},
			get parent() {
				return element.parent;
			},
			get value() {
				return element.value;
			},
			releaseGroup(group) {
				element.#releaseGroup(group);
			},
			setChecked(checked, dirty = true) {
				element.#setChecked(checked, dirty);
			},
			setGroupDisabled(group, disabled) {
				element.#setGroupDisabled(group, disabled);
			},
			setIndeterminate(indeterminate) {
				element.#setIndeterminate(indeterminate);
			},
		};

		super.initializeCheckedControl("checkbox", "Please check this box.", CheckboxElement.#behavior);
		upgradeProperty(this, "indeterminate");
		upgradeProperty(this, "parent");

		registerCheckbox(this, this.#handle);
		this.#reconcileGroup()?.memberChanged(this.#handle);
	}

	/** Whether the checkbox is currently checked. */
	override get checked(): boolean {
		this.#reconcileGroup();
		return super.checked;
	}

	override set checked(value: boolean) {
		const checked = Boolean(value);
		const group = this.#reconcileGroup();
		if (group) {
			group.setChecked(this.#handle, checked);
			super.markCheckedDirty();
		} else {
			super.checked = checked;
		}
	}

	/** Whether the checkbox presents a mixed state without changing form submission. */
	get indeterminate(): boolean {
		return this.#indeterminate;
	}

	set indeterminate(value: boolean) {
		this.#setIndeterminate(Boolean(value));
	}

	/** Whether this checkbox is a non-submitting parent control for its direct checkbox group. */
	get parent(): boolean {
		return this.hasAttribute("parent");
	}

	set parent(value: boolean) {
		this.toggleAttribute("parent", Boolean(value));
	}

	/** Whether this checkbox participates in constraint validation. */
	override get willValidate(): boolean {
		return !this.parent && super.willValidate;
	}

	override attributeChangedCallback(name: string, previous: string | null, value: string | null): void {
		super.attributeChangedCallback(name, previous, value);

		if (name === "checked" || name === "disabled" || name === "parent" || name === "value") {
			this.#reconcileGroup()?.memberChanged(this.#handle);
		}
	}

	override formResetCallback(): void {
		super.formResetCallback();
		this.#reconcileGroup()?.memberChanged(this.#handle);
	}

	override formStateRestoreCallback(state: File | FormData | string | null, mode: "autocomplete" | "restore"): void {
		if (typeof state !== "string") {
			return;
		}
		const restored = restoredStates.get(state);
		if (!restored) {
			return;
		}

		this.#indeterminate = restored[1];
		super.formStateRestoreCallback(restored[0] ? "checked" : "unchecked", mode);
		this.#reconcileGroup()?.memberChanged(this.#handle);
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout() {
		return html`<span part="control" aria-hidden="true"><slot name="indicator"></slot></span><slot></slot>`;
	}

	protected override connect(connection: AUIElement.Connection): void {
		super.connect(connection);
		this.#reconcileGroup()?.memberChanged(this.#handle);
	}

	protected override moved(): void {
		this.#reconcileGroup()?.memberChanged(this.#handle);
	}

	#setGroupDisabled(group: CheckboxGroupController, disabled: boolean): void {
		if (this.#group !== undefined && this.#group !== group) {
			if (getDirectCheckboxGroup(this.#handle) !== group) {
				return;
			}
			this.#releaseGroup(this.#group);
		}
		this.#group = group;
		this.#groupDisabled = disabled;
		super.setAdditionalDisabled(disabled);
	}

	#releaseGroup(group: CheckboxGroupController): void {
		if (this.#group !== group) {
			return;
		}
		this.#group = undefined;
		this.#groupDisabled = false;
		super.setAdditionalDisabled(false);
	}

	#reconcileGroup(): CheckboxGroupController | undefined {
		const group = getDirectCheckboxGroup(this.#handle);
		if (group === this.#group && (!group || getCheckboxGroup(this.#handle) === group)) {
			return group;
		}
		if (this.#group) {
			this.#releaseGroup(this.#group);
		}
		if (group?.has(this.#handle)) {
			this.#group = group;
			return group;
		}
		return undefined;
	}

	#getChecked(): boolean {
		return super.checked;
	}

	#getEffectiveDisabled(): boolean {
		return super.effectiveDisabled;
	}

	#setChecked(checked: boolean, dirty: boolean): void {
		super.setChecked(checked, dirty);
	}

	#setIndeterminate(value: boolean): void {
		if (this.#indeterminate === value) {
			return;
		}
		this.#indeterminate = value;
		super.synchronizeCheckedControl();
	}
}
