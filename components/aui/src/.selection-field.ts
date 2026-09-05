import { nextEnabledOption, setListboxState } from "./.listbox.js";
import { AttributeOwner } from "./.ownership.js";
import type { SelectionOwner } from "./.selection.js";
import {
	invalidateSelectionId,
	ownSelectionId,
	ownsOption,
	registerSelectionOwner,
	sameValues,
	uniqueValues,
	unregisterSelectionOwner,
} from "./.selection.js";
import { upgradeProperty } from "./.upgrade.js";
import type { AUIElement } from "./aui-element.js";
import { FormAssociatedElement } from "./form-associated-element.js";
import { OptionElement } from "./option-element.js";

/** Immutable selection proposed by a FACE collection field. */
export interface SelectionChangeDetail {
	readonly value: string;
	readonly values: readonly string[];
	readonly sourceEvent: Event;
}

export interface SelectionEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<SelectionChangeDetail>;
}

interface OptionRecord {
	readonly defaultSelected: boolean;
	readonly disabled: boolean;
	readonly hasValue: boolean;
	readonly hidden: boolean | "until-found";
	readonly invalid: boolean;
	readonly option: OptionElement;
	readonly value: string;
}

interface FieldSnapshot {
	readonly connected: object | undefined;
	readonly control: HTMLElement | undefined;
	readonly disabled: boolean;
	readonly document: Document;
	readonly form: HTMLFormElement | null;
	readonly isConnected: boolean;
	readonly multiple: boolean;
	readonly options: readonly OptionRecord[];
	readonly popup: HTMLElement | undefined;
	readonly readOnly: boolean;
	readonly revision: number;
	readonly values: readonly string[];
}

const htmlNamespace = "http://www.w3.org/1999/xhtml";

const isHTMLElement = (element: Element): element is HTMLElement => element.namespaceURI === htmlNamespace;

/** Shared FACE collection mechanics for custom select and combobox controls. */
export abstract class SelectionFieldElement extends FormAssociatedElement {
	static readonly observedAttributes = [
		"aria-label",
		"aria-labelledby",
		"disabled",
		"form",
		"id",
		"multiple",
		"name",
		"readonly",
		"required",
	];

	#active: OptionElement | undefined;
	#attributes = new AttributeOwner();
	#boundControl: HTMLElement | undefined;
	#changing = false;
	#connected: object | undefined;
	#controlAbort: AbortController | undefined;
	#controlDisabled = false;
	#controlReadOnly = false;
	#dirty = false;
	#disabledByForm = false;
	#invalidOptions = new Set<OptionElement>();
	#ownedLabels: HTMLLabelElement[] = [];
	#ownedPopup: HTMLElement | undefined;
	readonly #owner: SelectionOwner;
	#pendingValues: readonly string[] | undefined;
	#records: readonly OptionRecord[] = [];
	#recovering = true;
	#refreshing = false;
	#revision = 0;
	#values: readonly string[] = Object.freeze([]);

	declare addEventListener: {
		<Type extends keyof SelectionEventMap>(
			type: Type,
			listener: (this: SelectionFieldElement, event: SelectionEventMap[Type]) => unknown,
			options?: boolean | AddEventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | AddEventListenerOptions,
		): void;
	};

	declare removeEventListener: {
		<Type extends keyof SelectionEventMap>(
			type: Type,
			listener: (this: SelectionFieldElement, event: SelectionEventMap[Type]) => unknown,
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
		this.#owner = {
			element: this,
			membershipChanged() {
				element.#membershipChanged();
			},
			setOptionSelected(option, selected) {
				return element.#setOptionSelected(option, selected);
			},
		};
		for (const property of ["name", "multiple", "disabled", "readOnly", "required", "value", "values"] as const) {
			upgradeProperty(this, property);
		}
		this.#recovering = false;
		registerSelectionOwner(this.#owner);
		try {
			this.#refresh();
		} catch (error) {
			unregisterSelectionOwner(this.#owner);
			throw error;
		}
	}

	get value(): string {
		return this.values[0] ?? "";
	}

	set value(value: string) {
		this.values = [String(value)];
	}

	/** A frozen DOM-order selection. `[]` is distinct from `[""]`. */
	get values(): readonly string[] {
		this.#refresh(true);
		return this.#values;
	}

	set values(values: readonly string[]) {
		const requested = uniqueValues(values);
		++this.#revision;
		this.#dirty = true;
		if (this.#recovering) {
			this.#pendingValues = requested;
			return;
		}
		this.#refresh(true);
		this.#setRequestedValues(requested);
	}

	get multiple(): boolean {
		return this.hasAttribute("multiple");
	}

	set multiple(value: boolean) {
		this.toggleAttribute("multiple", Boolean(value));
	}

	protected override synchronizeValidity(): void {
		this.#synchronize();
	}

	/** Reconciles current native controls, options, and external FACE label associations. */
	refresh(): void {
		const popup = this.popup();
		if (popup) {
			invalidateSelectionId(popup);
		}
		for (const option of this.options()) {
			invalidateSelectionId(option);
		}
		for (const label of this.internals.labels) {
			if (label.nodeType === 1) {
				invalidateSelectionId(label as Element);
			}
		}
		++this.#revision;
		this.#refresh();
	}

	override focus(options?: FocusOptions): void {
		this.control()?.focus(options);
	}

	attributeChangedCallback(): void {
		++this.#revision;
		if (!this.#recovering) {
			this.#refresh();
		}
	}

	formAssociatedCallback(_form: HTMLFormElement | null): void {
		++this.#revision;
		this.#refresh();
	}

	formDisabledCallback(disabled: boolean): void {
		++this.#revision;
		this.#disabledByForm = disabled;
		this.#refresh();
	}

	formResetCallback(): void {
		this.#refresh();
		++this.#revision;
		this.#dirty = false;
		this.#pendingValues = undefined;
		this.#applyValues(this.#defaultValues());
	}

	formStateRestoreCallback(state: File | FormData | string | null, _mode: "autocomplete" | "restore"): void {
		if (typeof state !== "string") {
			return;
		}
		try {
			const restored = JSON.parse(state);
			if (Array.isArray(restored) && restored.every((value) => typeof value === "string")) {
				this.#refresh(true);
				this.#dirty = true;
				this.#setRequestedValues(uniqueValues(restored));
			}
		} catch {}
	}

	protected get effectiveDisabled(): boolean {
		this.#refresh();
		return this.#controlDisabled;
	}

	protected get effectiveReadOnly(): boolean {
		this.#refresh();
		return this.#controlReadOnly;
	}

	protected abstract control(): HTMLElement | undefined;

	protected popup(): HTMLElement | undefined {
		return [...this.children].find(
			(child): child is HTMLElement => isHTMLElement(child) && child.hasAttribute("popover"),
		);
	}

	protected options(): readonly OptionElement[] {
		const popup = this.popup();
		return popup
			? [...popup.querySelectorAll("*")].filter(
					(option): option is OptionElement => option instanceof OptionElement && ownsOption(this, option),
				)
			: [];
	}

	protected abstract bindControl(control: HTMLElement, signal: AbortSignal): void;

	protected configureControl(_control: HTMLElement): void {}

	protected authoredControlAttribute(control: HTMLElement, name: string): string | null {
		return this.#attributes.authorValue(control, name);
	}

	protected ownControlAttribute(control: HTMLElement, name: string, value: string | null): void {
		this.#attributes.own(control, name, value);
	}

	protected selectFromEvent(event: Event): boolean {
		if (this.#changing || event.defaultPrevented) {
			return false;
		}
		this.#refresh(true);
		if (this.#controlDisabled || this.#controlReadOnly) {
			return false;
		}
		const option = event.composedPath().find((target): target is OptionElement => target instanceof OptionElement);
		const record = option && this.#record(option);
		if (!record || !this.#eligible(record)) {
			return false;
		}

		return this.#propose(option, this.#toggledValues(record.value), event);
	}

	protected moveActive(delta: number): OptionElement | undefined {
		this.#refresh(true);
		const eligible = this.#records.filter((record) => this.#eligible(record)).map((record) => record.option);
		const active = nextEnabledOption(eligible, this.#active, delta);
		if (active !== this.#active) {
			++this.#revision;
			this.#active = active;
			this.#synchronize();
		}
		return this.#active;
	}

	protected acceptActive(event: Event): boolean {
		this.#refresh(true);
		const popup = this.popup();
		const record = this.#active && this.#record(this.#active);
		if (!popup?.matches(":popover-open") || !record || !this.#eligible(record)) {
			return false;
		}
		return this.#propose(record.option, this.#toggledValues(record.value), event);
	}

	protected togglePopup(source?: HTMLElement): boolean {
		const popup = this.popup();
		if (!popup) {
			return false;
		}
		popup.togglePopover(source ? { source } : undefined);
		this.#synchronize();
		return popup.matches(":popover-open");
	}

	protected showPopup(source?: HTMLElement): boolean {
		const popup = this.popup();
		if (!popup) {
			return false;
		}
		if (!popup.matches(":popover-open")) {
			popup.showPopover(source ? { source } : undefined);
		}
		this.#synchronize();
		return popup.matches(":popover-open");
	}

	protected hidePopup(): void {
		const popup = this.popup();
		if (popup?.matches(":popover-open")) {
			popup.hidePopover();
		}
	}

	protected override connect(connection: AUIElement.Connection): void {
		const connected = {};
		this.#connected = connected;
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: [
				"aria-label",
				"aria-activedescendant",
				"aria-controls",
				"aria-disabled",
				"aria-expanded",
				"aria-labelledby",
				"aria-multiselectable",
				"aria-readonly",
				"aria-required",
				"disabled",
				"form",
				"hidden",
				"id",
				"label",
				"multiple",
				"name",
				"popover",
				"readonly",
				"required",
				"role",
				"selected",
				"type",
				"value",
			],
			attributes: true,
			childList: true,
			subtree: true,
		});
		this.addEventListener("click", this.#onClick, { signal: connection.signal });
		this.addEventListener("toggle", this.#onToggle, { capture: true, signal: connection.signal });
		connection.addCleanup(() => {
			observer.disconnect();
			if (this.#connected !== connected) {
				return;
			}
			this.#connected = undefined;
			++this.#revision;
			this.#releaseControl();
			this.#releasePopup();
			this.#releaseLabels();
			this.#active = undefined;
			this.#records = [];
		});
		this.#refresh();
	}

	protected override moved(): void {
		++this.#revision;
		this.#refresh();
	}

	#onClick = (event: MouseEvent): void => {
		if (event.target === this) {
			if (!this.effectiveDisabled) {
				this.control()?.focus({ preventScroll: true });
			}
			return;
		}
		this.selectFromEvent(event);
	};

	#onToggle = (event: ToggleEvent): void => {
		if (event.target !== this.popup()) {
			return;
		}
		++this.#revision;
		if (event.newState === "closed") {
			this.#active = undefined;
		}
		this.#synchronize();
	};

	#membershipChanged(): void {
		++this.#revision;
		if (!this.#recovering) {
			this.#refresh();
		}
	}

	#setOptionSelected(option: OptionElement, selected: boolean): boolean {
		this.#refresh(true);
		const record = this.#record(option);
		if (!record || record.invalid) {
			return false;
		}
		this.#dirty = true;
		const values = selected
			? this.multiple
				? [...this.#values, record.value]
				: [record.value]
			: this.#values.filter((value) => value !== record.value);
		this.#setRequestedValues(uniqueValues(values));
		return true;
	}

	#propose(option: OptionElement, values: readonly string[], sourceEvent: Event): boolean {
		if (this.#changing || sameValues(values, this.#values)) {
			return false;
		}

		this.#changing = true;
		try {
			const before = this.#snapshot();
			const detail = Object.freeze({
				value: values[0] ?? "",
				values: Object.freeze([...values]),
				sourceEvent,
			}) satisfies SelectionChangeDetail;
			const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
			const proposal = new EventConstructor<SelectionChangeDetail>("beforechange", {
				bubbles: true,
				cancelable: true,
				composed: true,
				detail,
			});

			if (!this.dispatchEvent(proposal) || !this.#snapshotEquals(before, this.#snapshot())) {
				return false;
			}
			const current = this.#record(option);
			if (!current || !this.#eligible(current)) {
				return false;
			}

			this.#dirty = true;
			this.#applyValues(values);
			this.hidePopup();
			const committed = this.#snapshot();
			const Constructor = this.ownerDocument.defaultView?.Event ?? Event;
			this.dispatchEvent(new Constructor("input", { bubbles: true, composed: true }));
			if (!this.#snapshotEquals(committed, this.#snapshot())) {
				return true;
			}
			this.dispatchEvent(new Constructor("change", { bubbles: true }));
			return true;
		} finally {
			this.#changing = false;
		}
	}

	#snapshot(): FieldSnapshot {
		this.#refresh(true);
		return {
			connected: this.#connected,
			control: this.control(),
			disabled: this.#controlDisabled,
			document: this.ownerDocument,
			form: this.form,
			isConnected: this.isConnected,
			multiple: this.multiple,
			options: this.#records.map((record) => ({ ...record })),
			popup: this.popup(),
			readOnly: this.#controlReadOnly,
			revision: this.#revision,
			values: [...this.#values],
		};
	}

	#snapshotEquals(left: FieldSnapshot, right: FieldSnapshot): boolean {
		return (
			left.connected === right.connected &&
			left.control === right.control &&
			left.disabled === right.disabled &&
			left.document === right.document &&
			left.form === right.form &&
			left.isConnected === right.isConnected &&
			left.multiple === right.multiple &&
			left.popup === right.popup &&
			left.readOnly === right.readOnly &&
			left.revision === right.revision &&
			sameValues(left.values, right.values) &&
			left.options.length === right.options.length &&
			left.options.every((record, index) => this.#sameRecord(record, right.options[index]))
		);
	}

	#sameRecord(left: OptionRecord, right: OptionRecord): boolean {
		return (
			left.defaultSelected === right.defaultSelected &&
			left.disabled === right.disabled &&
			left.hasValue === right.hasValue &&
			left.hidden === right.hidden &&
			left.invalid === right.invalid &&
			left.option === right.option &&
			left.value === right.value
		);
	}

	#toggledValues(value: string): readonly string[] {
		return uniqueValues(
			this.multiple
				? this.#values.includes(value)
					? this.#values.filter((selected) => selected !== value)
					: [...this.#values, value]
				: [value],
		);
	}

	#setRequestedValues(requested: readonly string[]): void {
		if (this.#records.length === 0 && requested.length > 0) {
			this.#pendingValues = requested;
			this.#applyValues([]);
			return;
		}
		this.#pendingValues = undefined;
		const wanted = new Set(requested);
		this.#applyValues(
			this.#records.filter((record) => !record.invalid && wanted.has(record.value)).map((record) => record.value),
		);
	}

	#applyValues(values: readonly string[]): void {
		const next = Object.freeze(this.multiple ? [...values] : values.slice(0, 1));
		++this.#revision;
		this.#values = next;
		this.#synchronize();
	}

	#defaultValues(): readonly string[] {
		const values = this.#records
			.filter((record) => record.defaultSelected && !record.invalid)
			.map((record) => record.value);
		return Object.freeze(this.multiple ? values : values.slice(0, 1));
	}

	#refresh(validate = false): void {
		if (this.#refreshing) {
			if (validate) {
				this.#validate();
			}
			return;
		}
		this.#refreshing = true;
		try {
			const previous = this.#records;
			const options = this.options();
			const counts = new Map<string, number>();
			for (const option of options) {
				const value = option.getAttribute("value");
				if (value !== null) {
					counts.set(value, (counts.get(value) ?? 0) + 1);
				}
			}
			const records = options.map((option): OptionRecord => {
				const attribute = option.getAttribute("value");
				return {
					defaultSelected: option.defaultSelected,
					disabled: option.disabled,
					hasValue: attribute !== null,
					hidden: option.hidden,
					invalid: attribute === null || counts.get(attribute) !== 1,
					option,
					value: attribute ?? "",
				};
			});
			const recordsChanged =
				previous.length !== records.length ||
				previous.some((record, index) => !this.#sameRecord(record, records[index]));
			this.#records = records;
			this.#invalidOptions = new Set(records.filter((record) => record.invalid).map((record) => record.option));
			if (recordsChanged) {
				++this.#revision;
			}

			const validValues = new Set(records.filter((record) => !record.invalid).map((record) => record.value));
			let next = this.#dirty ? this.#values.filter((value) => validValues.has(value)) : this.#defaultValues();
			if (!this.multiple) {
				next = next.slice(0, 1);
			}
			if (!sameValues(next, this.#values)) {
				++this.#revision;
				this.#values = Object.freeze([...next]);
			}
			if (this.#pendingValues && records.length > 0 && this.#invalidOptions.size === 0) {
				const pending = this.#pendingValues;
				this.#pendingValues = undefined;
				const wanted = new Set(pending);
				this.#values = Object.freeze(
					records
						.filter((record) => wanted.has(record.value))
						.map((record) => record.value)
						.slice(0, this.multiple ? undefined : 1),
				);
				++this.#revision;
			}
			const active = this.#active && this.#record(this.#active);
			if (!active || !this.#eligible(active)) {
				if (this.#active) {
					++this.#revision;
				}
				this.#active = undefined;
			}

			if (this.#connected) {
				this.#bindCurrentControl();
				this.#ownCurrentPopup();
			} else {
				this.#releaseControl();
				this.#releasePopup();
				this.#releaseLabels();
			}
			this.#synchronize();
			if (validate) {
				this.#validate();
			}
		} finally {
			this.#refreshing = false;
		}
	}

	#validate(): void {
		if (this.#records.some((record) => !record.hasValue)) {
			throw new TypeError("An AUI selection option requires an explicit value attribute");
		}
		if (this.#invalidOptions.size > 0) {
			throw new TypeError("AUI selection option values must be unique");
		}
	}

	#bindCurrentControl(): void {
		const control = this.control();
		if (control !== this.#boundControl) {
			this.#releaseControl();
			this.#boundControl = control;
			if (control) {
				const Controller = this.ownerDocument.defaultView?.AbortController ?? AbortController;
				this.#controlAbort = new Controller();
				this.bindControl(control, this.#controlAbort.signal);
			}
			++this.#revision;
		}
		if (control) {
			this.#synchronizeLabels(control);
		}
	}

	#releaseControl(): void {
		this.#controlAbort?.abort();
		this.#controlAbort = undefined;
		if (this.#boundControl) {
			this.#attributes.release(this.#boundControl);
		}
		this.#boundControl = undefined;
		this.#controlDisabled = this.disabled || this.#disabledByForm;
		this.#controlReadOnly = this.readOnly;
	}

	#ownCurrentPopup(): void {
		const popup = this.popup();
		if (popup !== this.#ownedPopup) {
			this.#releasePopup();
			this.#ownedPopup = popup;
			++this.#revision;
		}
		if (popup) {
			this.#attributes.own(popup, "popover", "auto");
		}
	}

	#releasePopup(): void {
		if (this.#ownedPopup) {
			this.#attributes.release(this.#ownedPopup);
		}
		this.#ownedPopup = undefined;
	}

	#synchronizeLabels(control: HTMLElement): void {
		const labels = [...this.internals.labels].filter(
			(label): label is HTMLLabelElement => label.nodeType === 1 && (label as HTMLLabelElement).control === this,
		);
		for (const label of this.#ownedLabels) {
			if (!labels.includes(label)) {
				this.#attributes.releaseAttribute(label, "id");
			}
		}
		this.#ownedLabels = labels;
		const labelIds = labels.map((label) => ownSelectionId(this.#attributes, label, "aui-selection-label"));
		const controlIds = this.#attributes.authorValue(control, "aria-labelledby")?.split(/\s+/).filter(Boolean) ?? [];
		const hostIds = this.getAttribute("aria-labelledby")?.split(/\s+/).filter(Boolean) ?? [];
		const ids = [...new Set([...controlIds, ...hostIds, ...labelIds])];
		this.#attributes.own(control, "aria-labelledby", ids.length > 0 ? ids.join(" ") : null);

		const controlLabel = this.#attributes.authorValue(control, "aria-label");
		this.#attributes.own(control, "aria-label", controlLabel ?? this.getAttribute("aria-label"));
	}

	#releaseLabels(): void {
		for (const label of this.#ownedLabels) {
			this.#attributes.releaseAttribute(label, "id");
		}
		this.#ownedLabels = [];
	}

	#synchronize(): void {
		const popup = this.popup();
		const control = this.control();
		const selected = new Set(this.#values);
		setListboxState(
			this.#records.map((record) => record.option),
			this.#active,
			selected,
			this.#invalidOptions,
		);

		if (this.#connected && popup) {
			ownSelectionId(this.#attributes, popup, "aui-selection-listbox");
			this.#attributes.own(popup, "role", "listbox");
			this.#attributes.own(popup, "aria-multiselectable", this.multiple ? "true" : null);
		}

		if (this.#connected && control) {
			const authorDisabled = this.#attributes.authorValue(control, "disabled") !== null;
			this.#controlDisabled = this.disabled || this.#disabledByForm || authorDisabled;
			this.#controlReadOnly = this.readOnly || this.controlHasAuthoredReadOnly(control);
			this.#attributes.own(control, "disabled", this.#controlDisabled ? "" : null);
			this.#attributes.own(control, "role", "combobox");
			this.#attributes.own(control, "aria-disabled", String(this.#controlDisabled));
			this.#attributes.own(control, "aria-readonly", String(this.#controlReadOnly));
			this.#attributes.own(control, "aria-required", String(this.required));
			this.#attributes.own(control, "aria-expanded", String(popup?.matches(":popover-open") ?? false));
			this.#attributes.own(control, "aria-controls", popup?.id || null);
			this.#attributes.own(
				control,
				"aria-activedescendant",
				popup?.matches(":popover-open") && this.#active ? this.#active.id : null,
			);
			this.configureControl(control);
		} else {
			this.#controlDisabled = this.disabled || this.#disabledByForm;
			this.#controlReadOnly = this.readOnly;
		}

		this.internals.setFormValue(
			this.#controlDisabled || this.#invalidOptions.size > 0 || !this.name
				? null
				: this.multiple
					? this.#formData()
					: (this.#values[0] ?? null),
			JSON.stringify(this.#values),
		);
		const valueMissing = !this.#controlDisabled && this.required && this.#values.length === 0;
		if (super.customValidity) {
			this.internals.setValidity(
				{ customError: true, ...(valueMissing ? { valueMissing: true } : {}) },
				super.customValidity,
				control,
			);
		} else if (valueMissing) {
			this.internals.setValidity({ valueMissing: true }, "Please select an option.", control);
		} else {
			this.internals.setValidity({});
		}
	}

	protected controlHasAuthoredReadOnly(_control: HTMLElement): boolean {
		return false;
	}

	#formData(): FormData {
		const FormDataConstructor = this.ownerDocument.defaultView?.FormData ?? FormData;
		const data = new FormDataConstructor();
		for (const value of this.#values) {
			data.append(this.name, value);
		}
		return data;
	}

	#record(option: OptionElement): OptionRecord | undefined {
		return this.#records.find((record) => record.option === option);
	}

	#eligible(record: OptionRecord): boolean {
		return !record.invalid && !record.disabled && !record.hidden;
	}
}
