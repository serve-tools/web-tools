import { AttributeOwner } from "./_ownership.js";
import { setCustomState } from "./_states.js";
import { upgradeProperty } from "./_upgrade.js";
import { BaseElement } from "./BaseElement.js";
import { html } from "./template.js";

/** A native-like public form-control surface required from custom controls used by {@link FieldElement}. */
export interface FieldControl extends HTMLElement {
	readonly form: HTMLFormElement | null;
	readonly validationMessage: string;
	readonly validity: ValidityState;
	readonly willValidate: boolean;
	readonly checked?: boolean;
	readonly files?: FileList | null;
	readonly value?: unknown;
	readonly values?: readonly unknown[];
	checkValidity(): boolean;
	reportValidity(): boolean;
	setCustomValidity(message: string): void;
	/** Reconciles an internal focus surface after Field changes the effective native label association. */
	refresh?(): void;
}

type AttributeValue = string | null;

interface OwnedTokens {
	author: AttributeValue;
	owned: readonly string[];
	written: AttributeValue;
}

interface ValueSnapshot {
	readonly kind: string;
	readonly values: readonly unknown[];
}

const htmlNamespace = "http://www.w3.org/1999/xhtml";
const checkableTypes = new Set(["checkbox", "radio"]);
const fieldSlots = {
	after: 1 << 0,
	before: 1 << 1,
	control: 1 << 2,
	description: 1 << 3,
	error: 1 << 4,
	label: 1 << 5,
	"label-actions": 1 << 6,
} as const;
const labelContentSlots = fieldSlots.label | fieldSlots["label-actions"];
const controlContentSlots = fieldSlots.before | fieldSlots.control | fieldSlots.after;
const observedAttributes = [
	"aria-describedby",
	"aria-errormessage",
	"aria-invalid",
	"aria-labelledby",
	"checked",
	"disabled",
	"for",
	"form",
	"id",
	"readonly",
	"required",
	"selected",
	"slot",
	"type",
	"value",
];
let generatedId = 0;

const isHTMLElement = (element: Element): element is HTMLElement => element.namespaceURI === htmlNamespace;
const isLabel = (element: Element): element is HTMLLabelElement =>
	isHTMLElement(element) && element.localName === "label";
const isNativeInput = (element: unknown): element is HTMLInputElement => {
	const ownerDocument = (element as { readonly ownerDocument?: Document } | null)?.ownerDocument;
	const Input = ownerDocument?.defaultView?.HTMLInputElement ?? HTMLInputElement;
	return element instanceof Input && element.namespaceURI === htmlNamespace && element.localName === "input";
};

const tokens = (value: AttributeValue): string[] => value?.split(/\s+/u).filter(Boolean) ?? [];
const unique = (values: readonly string[]): string[] => [...new Set(values)];
const isFormData = (value: unknown): value is FormData =>
	typeof value === "object" &&
	value !== null &&
	Object.prototype.toString.call(value) === "[object FormData]" &&
	typeof (value as FormData).entries === "function";

const isFieldControl = (element: Element): element is FieldControl => {
	if (!isHTMLElement(element)) {
		return false;
	}

	return (
		"form" in element &&
		"validity" in element &&
		"validationMessage" in element &&
		"willValidate" in element &&
		("value" in element || "values" in element || "checked" in element) &&
		typeof (element as Partial<FieldControl>).checkValidity === "function" &&
		typeof (element as Partial<FieldControl>).reportValidity === "function" &&
		typeof (element as Partial<FieldControl>).setCustomValidity === "function"
	);
};

const resolveFieldControl = (participant: HTMLElement): FieldControl | undefined => {
	if (isFieldControl(participant)) {
		return participant;
	}
	if (!("input" in participant)) {
		return undefined;
	}

	const input = (participant as { readonly input?: unknown }).input;
	return isNativeInput(input) &&
		isFieldControl(input) &&
		participant.contains(input) &&
		participant.getRootNode() === input.getRootNode()
		? input
		: undefined;
};

const sameElements = (left: readonly Element[], right: readonly Element[]): boolean =>
	left.length === right.length && left.every((element, index) => element === right[index]);

const sameSnapshot = (left: ValueSnapshot, right: ValueSnapshot): boolean =>
	left.kind === right.kind &&
	left.values.length === right.values.length &&
	left.values.every((value, index) => Object.is(value, right.values[index]));

const valueSnapshot = (control: FieldControl): ValueSnapshot => {
	if (control.localName === "input") {
		const type = String((control as HTMLInputElement).type).toLowerCase();
		if (checkableTypes.has(type)) {
			return { kind: type, values: [Boolean((control as HTMLInputElement).checked)] };
		}
		if (type === "file") {
			return { kind: type, values: [...((control as HTMLInputElement).files ?? [])] };
		}
		return { kind: "value", values: [(control as HTMLInputElement).value] };
	}

	if (control.localName === "select" && (control as HTMLSelectElement).multiple) {
		return {
			kind: "selected",
			values: [...(control as HTMLSelectElement).selectedOptions].map((option) => option.index),
		};
	}

	if (control.localName.includes("-")) {
		const values = control.values;
		if (Array.isArray(values)) {
			return { kind: "values", values: [...values] };
		}
		if (typeof control.checked === "boolean") {
			return { kind: "checked", values: [control.checked] };
		}
	}

	const value = control.value;
	if (Array.isArray(value)) {
		return { kind: "values", values: [...value] };
	}
	if (isFormData(value)) {
		return { kind: "form-data", values: [...value].flat() };
	}

	return { kind: "value", values: [value] };
};

const isFilled = (snapshot: ValueSnapshot): boolean => {
	if (checkableTypes.has(snapshot.kind) || snapshot.kind === "checked") {
		return Boolean(snapshot.values[0]);
	}
	if (["file", "form-data", "selected", "values"].includes(snapshot.kind)) {
		return snapshot.values.length > 0;
	}

	const value = snapshot.values[0];
	return value !== undefined && value !== null && value !== "";
};

/** Coordinates one authored form control with its authored label, descriptions, errors, and presentation state. */
export class FieldElement extends BaseElement {
	#ancestorObserver: MutationObserver | undefined;
	#attributes = new AttributeOwner();
	#baseline: ValueSnapshot | undefined;
	#connectionEpoch = 0;
	#connectionSignal: AbortSignal | undefined;
	#control: FieldControl | undefined;
	#descriptions: readonly HTMLElement[] = Object.freeze([]);
	#dirty = false;
	#disabled = false;
	#errors: readonly HTMLElement[] = Object.freeze([]);
	#errorVisible = false;
	#fallbackDescription: HTMLParagraphElement | undefined;
	#fallbackError: HTMLParagraphElement | undefined;
	#fallbackLabel: HTMLLabelElement | undefined;
	#filled = false;
	#focused = false;
	#invalid = false;
	#invalidEvent = false;
	#ids = new WeakMap<HTMLElement, string>();
	#label: HTMLLabelElement | undefined;
	#observer: MutationObserver | undefined;
	#refreshQueued = false;
	#refreshing = false;
	#resetRoot: Document | ShadowRoot | undefined;
	#required = false;
	#relationshipControl: FieldControl | undefined;
	#relationshipLabel: HTMLLabelElement | undefined;
	#relationshipLabelId: string | undefined;
	#sectionVisibility = -1;
	#sections: readonly HTMLElement[] | undefined;
	#shellInitialized = false;
	#slots = 0;
	#tokens = new TokenOwner();
	#touched = false;
	#valid: boolean | null = null;
	#wasFocused = false;

	constructor() {
		super();

		for (const property of ["description", "error", "label", "showError"] as const) {
			upgradeProperty(this, property);
		}
	}

	/** The direct `slot="control"` element when exactly one usable control participates. */
	get control(): FieldControl | null {
		this.#refresh();
		return this.#control ?? null;
	}

	/** Default label text used when no authored `label` slot participates. */
	get label(): string {
		return this.getAttribute("label") ?? "";
	}

	set label(value: string) {
		this.setAttribute("label", String(value));
		this.#refresh();
	}

	/** Default description text used when no authored `description` slot participates. */
	get description(): string {
		return this.getAttribute("description") ?? "";
	}

	set description(value: string) {
		this.setAttribute("description", String(value));
		this.#refresh();
	}

	/** Presentation-only error text used when no authored `error` slot participates. */
	get error(): string {
		return this.getAttribute("error") ?? "";
	}

	set error(value: string) {
		this.setAttribute("error", String(value));
		this.#refresh();
	}

	/** Whether invalid error presentation is forced before the control is touched. */
	get showError(): boolean {
		return this.hasAttribute("show-error");
	}

	set showError(value: boolean) {
		this.toggleAttribute("show-error", Boolean(value));
		this.#refresh();
	}

	/** The active direct native label, including the generated text fallback. */
	get labelElement(): HTMLLabelElement | null {
		this.#refresh();
		return this.#label ?? null;
	}

	/** Active `slot="description"` elements in document order, including the generated text fallback. */
	get descriptions(): readonly HTMLElement[] {
		this.#refresh();
		return this.#descriptions;
	}

	/** Active `slot="error"` elements in document order, including the generated text fallback. */
	get errors(): readonly HTMLElement[] {
		this.#refresh();
		return this.#errors;
	}

	/** Native validity, or `null` while no participating control can be validated. */
	get valid(): boolean | null {
		this.#refresh();
		return this.#valid;
	}

	/** Whether the participating control currently fails native constraint validation. */
	get invalid(): boolean {
		this.#refresh();
		return this.#invalid;
	}

	/** Whether invalid error presentation is currently active. */
	get errorVisible(): boolean {
		this.#refresh();
		return this.#errorVisible;
	}

	/** Whether the current value differs from the association or reset baseline. */
	get dirty(): boolean {
		this.#refresh();
		return this.#dirty;
	}

	/** Whether focus has left the current control since association or reset. */
	get touched(): boolean {
		this.#refresh();
		return this.#touched;
	}

	/** Whether the current control exposes a nonempty value or checked state. */
	get filled(): boolean {
		this.#refresh();
		return this.#filled;
	}

	/** Whether focus is currently on or within the current control. */
	get focused(): boolean {
		this.#refresh();
		return this.#focused;
	}

	/** Whether the current control is disabled directly or by native ancestry. */
	get disabled(): boolean {
		this.#refresh();
		return this.#disabled;
	}

	/** Whether the current control reports that a value is required. */
	get required(): boolean {
		this.#refresh();
		return this.#required;
	}

	/** Reconciles relationships and state after silent control property or validity changes. */
	refresh(): void {
		this.#refresh();
	}

	/** Makes the current value pristine and untouched without changing the control or form. */
	resetState(): void {
		this.#refresh();
		this.#baseline = this.#control ? valueSnapshot(this.#control) : undefined;
		this.#dirty = false;
		this.#touched = false;
		this.#invalidEvent = false;
		this.#wasFocused = this.#focused;
		this.#synchronizePresentation();
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout() {
		return html`
			<style>
				:host {
					display: block;
				}
				[part="content"] {
					display: grid;
				}
				[part="label-content"],
				[part="control-content"] {
					display: flex;
				}
				[hidden] {
					display: none !important;
				}
			</style>
			<div part="content">
				<div part="label-content">
					<slot name="label" part="label"></slot>
					<slot name="label-actions" part="label-actions"></slot>
				</div>
				<div part="control-content">
					<slot name="before" part="before"></slot>
					<slot name="control" part="control"></slot>
					<slot name="after" part="after"></slot>
				</div>
				<div part="description-content"><slot name="description" part="description"></slot></div>
				<div part="error-content"><slot name="error" part="error"></slot></div>
			</div>
		`;
	}

	protected override connect(connection: BaseElement.Connection): void {
		const epoch = ++this.#connectionEpoch;
		this.#connectionSignal = connection.signal;
		this.#shellInitialized = true;
		this.#sections ??= ["label-content", "control-content", "description-content", "error-content"].map(
			(part) => this.shadowRoot!.querySelector<HTMLElement>(`[part='${part}']`)!,
		);
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		const ancestorObserver = new Observer(() => {
			this.#observeAncestors();
			this.#refresh();
		});
		this.#observer = observer;
		this.#ancestorObserver = ancestorObserver;
		connection.addCleanup(() => {
			observer.disconnect();
			ancestorObserver.disconnect();
			this.#releaseResetRoot();
			this.#releaseRelationships();
			if (this.#observer === observer) {
				this.#observer = undefined;
			}
			if (this.#ancestorObserver === ancestorObserver) {
				this.#ancestorObserver = undefined;
			}
			if (this.#connectionEpoch === epoch) {
				++this.#connectionEpoch;
				this.#connectionSignal = undefined;
			}
		});
		observer.observe(this, {
			attributeFilter: [...observedAttributes, "description", "error", "label", "show-error"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		this.#observeAncestors();
		this.#observeResetRoot();

		this.addEventListener("change", this.#onValueChange, { signal: connection.signal });
		this.addEventListener("focusin", this.#onFocusIn, { signal: connection.signal });
		this.addEventListener("focusout", this.#onFocusOut, { signal: connection.signal });
		this.addEventListener("input", this.#onValueChange, { signal: connection.signal });
		this.addEventListener("invalid", this.#onInvalid, { capture: true, signal: connection.signal });
		this.#refresh();
	}

	protected override moved(): void {
		this.#observeAncestors();
		this.#observeResetRoot();
		this.#refresh();
	}

	#onValueChange = (event: Event): void => {
		if (!this.#eventUsesControl(event)) {
			return;
		}
		this.#refresh();
		this.#queueRefresh();
	};

	#onFocusIn = (event: FocusEvent): void => {
		if (!this.#eventUsesControl(event)) {
			return;
		}
		this.#wasFocused = true;
		this.#refresh();
	};

	#onFocusOut = (event: FocusEvent): void => {
		if (!this.#eventUsesControl(event)) {
			return;
		}
		const control = this.#control;
		const epoch = this.#connectionEpoch;
		const signal = this.#connectionSignal;
		queueMicrotask(() => {
			if (signal?.aborted || epoch !== this.#connectionEpoch || control !== this.#control) {
				return;
			}
			this.#refresh();
			if (!this.#focused && this.#wasFocused) {
				this.#touched = true;
				this.#synchronizePresentation();
			}
		});
	};

	#onInvalid = (event: Event): void => {
		if (!this.#eventUsesControl(event)) {
			return;
		}
		this.#invalidEvent = true;
		this.#refresh();
		this.#queueRefresh();
	};

	#onReset = (event: Event): void => {
		const control = this.#control;
		const form = event.target;
		if (!control || control.form !== form) {
			return;
		}
		const epoch = this.#connectionEpoch;
		const signal = this.#connectionSignal;
		// Trusted reset events can run microtasks before their native default action.
		setTimeout(() => {
			if (
				event.defaultPrevented ||
				signal?.aborted ||
				epoch !== this.#connectionEpoch ||
				control !== this.#control ||
				control.form !== form
			) {
				return;
			}
			this.resetState();
		});
	};

	#eventUsesControl(event: Event): boolean {
		return !!this.#control && event.composedPath().includes(this.#control);
	}

	#queueRefresh(): void {
		if (this.#refreshQueued) {
			return;
		}
		this.#refreshQueued = true;
		const epoch = this.#connectionEpoch;
		const signal = this.#connectionSignal;
		queueMicrotask(() => {
			this.#refreshQueued = false;
			if (signal?.aborted || epoch !== this.#connectionEpoch) {
				return;
			}
			this.#refresh();
		});
	}

	#observeAncestors(): void {
		const observer = this.#ancestorObserver;
		if (!observer) {
			return;
		}
		observer.disconnect();
		for (let ancestor = this.parentElement; ancestor; ancestor = ancestor.parentElement) {
			if (ancestor.namespaceURI === htmlNamespace && ancestor.localName === "fieldset") {
				observer.observe(ancestor, { attributeFilter: ["disabled"], attributes: true, childList: true });
			}
		}
	}

	#observeResetRoot(): void {
		const root = this.getRootNode() as Document | ShadowRoot;
		if (root === this.#resetRoot) {
			return;
		}

		root.addEventListener("reset", this.#onReset, true);
		this.#releaseResetRoot();
		this.#resetRoot = root;
	}

	#releaseResetRoot(): void {
		this.#resetRoot?.removeEventListener("reset", this.#onReset, true);
		this.#resetRoot = undefined;
	}

	#refresh(): void {
		if (this.#refreshing) {
			return;
		}
		this.#refreshing = true;

		try {
			let slots = 0;
			const controls: FieldControl[] = [];
			const labels: HTMLLabelElement[] = [];
			const descriptions: HTMLElement[] = [];
			const errors: HTMLElement[] = [];
			for (const child of [...this.children]) {
				if (
					!isHTMLElement(child) ||
					child === this.#fallbackDescription ||
					child === this.#fallbackError ||
					child === this.#fallbackLabel
				) {
					continue;
				}

				const slot = child.slot;
				slots |= fieldSlots[slot as keyof typeof fieldSlots] ?? 0;
				if (slot === "control") {
					const control = resolveFieldControl(child);
					if (control) {
						controls.push(control);
					}
				} else if (slot === "label" && isLabel(child)) {
					labels.push(child);
				} else if (slot === "description") {
					descriptions.push(child);
				} else if (slot === "error") {
					errors.push(child);
				}
			}
			const control = controls.length === 1 ? controls[0] : undefined;
			const value = control ? valueSnapshot(control) : undefined;
			const baseline = control !== this.#control || !this.#baseline ? value : this.#baseline;
			let valid: boolean | null = null;
			let dirty = false;
			let disabled = false;
			let filled = false;
			let focused = false;
			let required = false;
			if (control && baseline && value) {
				valid = control.willValidate ? control.validity.valid : null;
				dirty = !sameSnapshot(baseline, value);
				disabled = control.matches(":disabled") || Boolean((control as { disabled?: boolean }).disabled);
				filled = isFilled(value);
				focused = control.matches(":focus-within");
				required = control.matches(":required") || Boolean((control as { required?: boolean }).required);
			}
			const error =
				this.error ||
				(!(slots & fieldSlots.error) && valid === false && control ? control.validationMessage : "");
			this.#synchronizeFallback("label", this.label, Boolean(slots & fieldSlots.label));
			this.#synchronizeFallback("description", this.description, Boolean(slots & fieldSlots.description));
			this.#synchronizeFallback("error", error, Boolean(slots & fieldSlots.error));

			if (this.#fallbackLabel?.parentNode === this) {
				labels.push(this.#fallbackLabel);
				slots |= fieldSlots.label;
			}
			if (this.#fallbackDescription?.parentNode === this) {
				descriptions.push(this.#fallbackDescription);
				slots |= fieldSlots.description;
			}
			if (this.#fallbackError?.parentNode === this) {
				errors.push(this.#fallbackError);
				slots |= fieldSlots.error;
			}
			const label = labels.length === 1 ? labels[0] : undefined;
			this.#slots = slots;

			this.#reconcileParticipants(control, label, descriptions, errors, baseline);
			this.#valid = valid;
			this.#dirty = dirty;
			this.#disabled = disabled;
			this.#filled = filled;
			this.#focused = focused;
			this.#invalid = valid === false;
			if (!this.#invalid) {
				this.#invalidEvent = false;
			}
			this.#required = required;
			if (this.#focused) {
				this.#wasFocused = true;
			}
			this.#synchronizePresentation();
		} finally {
			this.#refreshing = false;
		}
	}

	#synchronizeFallback(slot: "description" | "error" | "label", text: string, authored: boolean): void {
		if (!this.#shellInitialized) {
			return;
		}

		let fallback: HTMLLabelElement | HTMLParagraphElement | undefined;
		if (slot === "label") {
			fallback = this.#fallbackLabel;
		} else if (slot === "description") {
			fallback = this.#fallbackDescription;
		} else {
			fallback = this.#fallbackError;
		}
		if (authored || text === "") {
			if (fallback?.parentNode === this) {
				fallback.remove();
			}
			return;
		}

		if (!fallback) {
			if (slot === "label") {
				fallback = this.#fallbackLabel = this.ownerDocument.createElement("label");
			} else if (slot === "description") {
				fallback = this.#fallbackDescription = this.ownerDocument.createElement("p");
			} else {
				fallback = this.#fallbackError = this.ownerDocument.createElement("p");
			}
		}
		if (fallback.slot !== slot) {
			fallback.slot = slot;
		}
		if (fallback.textContent !== text) {
			fallback.textContent = text;
		}
		if (fallback.parentNode !== this) {
			this.append(fallback);
		}
	}

	#synchronizeSections(): void {
		const sections = this.#sections;
		if (!sections) {
			return;
		}

		const visibility =
			(this.#slots & labelContentSlots ? 1 : 0) |
			(this.#slots & controlContentSlots ? 2 : 0) |
			(this.#slots & fieldSlots.description ? 4 : 0) |
			(this.#slots & fieldSlots.error && this.#errorVisible ? 8 : 0);
		const changed = visibility ^ this.#sectionVisibility;
		if (changed === 0) {
			return;
		}
		this.#sectionVisibility = visibility;
		for (let index = 0; index < sections.length; ++index) {
			if (changed & (1 << index)) {
				this.#setSectionHidden(sections[index], !(visibility & (1 << index)));
			}
		}
	}

	#setSectionHidden(section: HTMLElement, hidden: boolean): void {
		if (section.hidden !== hidden) {
			section.hidden = hidden;
		}
	}

	#reconcileParticipants(
		control: FieldControl | undefined,
		label: HTMLLabelElement | undefined,
		descriptions: readonly HTMLElement[],
		errors: readonly HTMLElement[],
		baseline: ValueSnapshot | undefined,
	): void {
		if (control !== this.#control) {
			this.#releaseRelationships();
			this.#control = control;
			this.#baseline = baseline;
			this.#dirty = false;
			this.#touched = false;
			this.#invalidEvent = false;
			this.#wasFocused = false;
		}

		if (label !== this.#label) {
			if (this.#label) {
				this.#attributes.release(this.#label);
			}
			this.#label = label;
		}

		const retained = new Set<Element>([...descriptions, ...errors]);
		for (const element of [...this.#descriptions, ...this.#errors]) {
			if (!retained.has(element)) {
				this.#attributes.release(element);
			}
		}
		if (!sameElements(this.#descriptions, descriptions)) {
			this.#descriptions = Object.freeze([...descriptions]);
		}
		if (!sameElements(this.#errors, errors)) {
			this.#errors = Object.freeze([...errors]);
		}
	}

	#synchronizeRelationships(): void {
		const control = this.#control;
		if (!control) {
			return;
		}

		const controlId = this.#id(control, "control");
		const labelId = this.#label && control.refresh ? this.#id(this.#label, "label") : undefined;
		const relationshipChanged =
			control !== this.#relationshipControl ||
			this.#label !== this.#relationshipLabel ||
			labelId !== this.#relationshipLabelId ||
			(this.#label !== undefined && this.#label.getAttribute("for") !== controlId);
		if (this.#label) {
			this.#attributes.own(this.#label, "for", controlId);
		}

		const descriptionIds = this.#descriptions.map((element) => this.#id(element, "description"));
		const errorIds = this.#errorVisible ? this.#errors.map((element) => this.#id(element, "error")) : [];
		this.#tokens.own(control, "aria-describedby", descriptionIds);
		this.#tokens.own(control, "aria-errormessage", errorIds);
		if (control.refresh) {
			this.#tokens.own(control, "aria-labelledby", labelId ? [labelId] : []);
		}

		if (this.#invalid && this.#attributes.authorValue(control, "aria-invalid") === null) {
			this.#attributes.own(control, "aria-invalid", "true");
		} else {
			this.#attributes.releaseAttribute(control, "aria-invalid");
		}

		this.#relationshipControl = control;
		this.#relationshipLabel = this.#label;
		this.#relationshipLabelId = labelId;
		if (relationshipChanged) {
			control.refresh?.();
		}
	}

	#id(element: HTMLElement, part: "control" | "description" | "error" | "label"): string {
		const authorId = this.#attributes.authorValue(element, "id");
		if (authorId) {
			this.#attributes.releaseAttribute(element, "id");
			return authorId;
		}

		let id = this.#ids.get(element);
		const root = element.getRootNode() as Document | ShadowRoot;
		const owner = id ? root.getElementById(id) : null;
		if (!id || (owner && owner !== element)) {
			do {
				id = `${this.localName || "base-field"}-${part}-${++generatedId}`;
			} while (root.getElementById(id));
			this.#ids.set(element, id);
		}
		this.#attributes.own(element, "id", id);
		return id;
	}

	#releaseRelationships(): void {
		const relationshipControl = this.#relationshipControl;
		if (this.#control) {
			this.#attributes.release(this.#control);
			this.#tokens.release(this.#control);
		}
		if (this.#label) {
			this.#attributes.release(this.#label);
		}
		for (const element of [...this.#descriptions, ...this.#errors]) {
			this.#attributes.release(element);
		}
		this.#relationshipControl = undefined;
		this.#relationshipLabel = undefined;
		this.#relationshipLabelId = undefined;
		if (relationshipControl?.isConnected) {
			relationshipControl.refresh?.();
		}
	}

	#synchronizeStates(): void {
		for (const [state, present] of [
			["valid", this.#valid === true],
			["invalid", this.#invalid],
			["dirty", this.#dirty],
			["touched", this.#touched],
			["filled", this.#filled],
			["focused", this.#focused],
			["disabled", this.#disabled],
			["required", this.#required],
			["error-visible", this.#errorVisible],
		] as const) {
			setCustomState(this.internals, state, present);
		}
	}

	#synchronizePresentation(): void {
		this.#errorVisible = this.#invalid && (this.#touched || this.#invalidEvent || this.showError);
		if (this.#connectionSignal && !this.#connectionSignal.aborted) {
			this.#synchronizeRelationships();
		}
		this.#synchronizeStates();
		this.#synchronizeSections();
	}
}

class TokenOwner {
	#attributes = new Map<Element, Map<string, OwnedTokens>>();

	own(element: Element, name: string, owned: readonly string[]): void {
		let attributes = this.#attributes.get(element);
		if (!attributes) {
			this.#attributes.set(element, (attributes = new Map()));
		}

		const current = element.getAttribute(name);
		let state = attributes.get(name);
		if (!state) {
			state = { author: current, owned: [], written: current };
			attributes.set(name, state);
		} else if (current !== state.written) {
			state.author = this.#without(current, state.owned);
		}

		state.owned = unique(owned);
		state.written = this.#combine(state.author, state.owned);
		this.#write(element, name, state.written);
	}

	release(element: Element): void {
		const attributes = this.#attributes.get(element);
		if (!attributes) {
			return;
		}

		for (const [name, state] of attributes) {
			const current = element.getAttribute(name);
			this.#write(element, name, current === state.written ? state.author : this.#without(current, state.owned));
		}
		this.#attributes.delete(element);
	}

	#combine(author: AttributeValue, owned: readonly string[]): AttributeValue {
		const combined = unique([...tokens(author), ...owned]);
		return combined.length > 0 ? combined.join(" ") : author === null ? null : "";
	}

	#without(value: AttributeValue, removed: readonly string[]): AttributeValue {
		const removedTokens = new Set(removed);
		const remaining = tokens(value).filter((token) => !removedTokens.has(token));
		return remaining.length > 0 ? remaining.join(" ") : value === null ? null : "";
	}

	#write(element: Element, name: string, value: AttributeValue): void {
		if (element.getAttribute(name) === value) {
			return;
		}
		if (value === null) {
			element.removeAttribute(name);
		} else {
			element.setAttribute(name, value);
		}
	}
}
