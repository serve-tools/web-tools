import { AUIElement } from "./aui-element.js";

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
}

type AttributeValue = string | null;

interface OwnedAttribute {
	author: AttributeValue;
	owned: AttributeValue;
}

interface OwnedTokens {
	author: AttributeValue;
	owned: readonly string[];
	written: AttributeValue;
}

interface ValueSnapshot {
	readonly kind: string;
	readonly values: readonly unknown[];
}

interface FieldState {
	readonly dirty: boolean;
	readonly disabled: boolean;
	readonly filled: boolean;
	readonly focused: boolean;
	readonly invalid: boolean;
	readonly required: boolean;
	readonly valid: boolean | null;
}

const htmlNamespace = "http://www.w3.org/1999/xhtml";
const checkableTypes = new Set(["checkbox", "radio"]);
const observedAttributes = [
	"aria-describedby",
	"aria-errormessage",
	"aria-invalid",
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

const readState = (
	control: FieldControl | undefined,
	baseline: ValueSnapshot | undefined,
	value: ValueSnapshot | undefined,
): FieldState => {
	if (!control || !baseline || !value) {
		return {
			dirty: false,
			disabled: false,
			filled: false,
			focused: false,
			invalid: false,
			required: false,
			valid: null,
		};
	}

	const valid = control.willValidate ? control.validity.valid : null;
	return {
		dirty: !sameSnapshot(baseline, value),
		disabled: control.matches(":disabled") || Boolean((control as { disabled?: boolean }).disabled),
		filled: isFilled(value),
		focused: control.matches(":focus-within"),
		invalid: valid === false,
		required: control.matches(":required") || Boolean((control as { required?: boolean }).required),
		valid,
	};
};

/** Coordinates one authored form control with its authored label, descriptions, errors, and presentation state. */
export class FieldElement extends AUIElement {
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
	#filled = false;
	#focused = false;
	#internals = this.attachInternals();
	#invalid = false;
	#ids = new WeakMap<HTMLElement, string>();
	#label: HTMLLabelElement | undefined;
	#observer: MutationObserver | undefined;
	#refreshQueued = false;
	#refreshing = false;
	#resetRoot: Document | ShadowRoot | undefined;
	#required = false;
	#tokens = new TokenOwner();
	#touched = false;
	#valid: boolean | null = null;
	#wasFocused = false;

	/** The direct `slot="control"` element when exactly one usable control participates. */
	get control(): FieldControl | null {
		this.#refresh();
		return this.#control ?? null;
	}

	/** The direct authored native label, when exactly one participates. */
	get label(): HTMLLabelElement | null {
		this.#refresh();
		return this.#label ?? null;
	}

	/** Direct authored `slot="description"` elements in document order. */
	get descriptions(): readonly HTMLElement[] {
		this.#refresh();
		return this.#descriptions;
	}

	/** Direct authored `slot="error"` elements in document order. */
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
		this.#wasFocused = this.#focused;
		this.#synchronizeStates();
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout(content: DocumentFragment): void {
		for (const name of ["label", "control", "description", "error"] as const) {
			const slot = content.ownerDocument.createElement("slot");
			slot.name = name;
			slot.part.add(name);
			content.append(slot);
		}
	}

	protected override connect(connection: AUIElement.Connection): void {
		const epoch = ++this.#connectionEpoch;
		this.#connectionSignal = connection.signal;
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
			attributeFilter: observedAttributes,
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
				this.#synchronizeStates();
			}
		});
	};

	#onInvalid = (event: Event): void => {
		if (!this.#eventUsesControl(event)) {
			return;
		}
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
		queueMicrotask(() => {
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
			const children = [...this.children].filter(isHTMLElement);
			const controls = children
				.filter((child) => child.slot === "control")
				.map(resolveFieldControl)
				.filter((control) => control !== undefined);
			const labels = children.filter(
				(child): child is HTMLLabelElement => child.slot === "label" && isLabel(child),
			);
			const descriptions = children.filter((child) => child.slot === "description");
			const errors = children.filter((child) => child.slot === "error");
			const control = controls.length === 1 ? controls[0] : undefined;
			const label = labels.length === 1 ? labels[0] : undefined;
			const value = control ? valueSnapshot(control) : undefined;
			const baseline = control !== this.#control || !this.#baseline ? value : this.#baseline;
			const state = readState(control, baseline, value);

			this.#reconcileParticipants(control, label, descriptions, errors, baseline);
			this.#readState(state);
			if (this.#connectionSignal && !this.#connectionSignal.aborted) {
				this.#synchronizeRelationships();
			}
			this.#synchronizeStates();
		} finally {
			this.#refreshing = false;
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

	#readState(state: FieldState): void {
		this.#valid = state.valid;
		this.#invalid = state.invalid;
		this.#dirty = state.dirty;
		this.#filled = state.filled;
		this.#focused = state.focused;
		this.#disabled = state.disabled;
		this.#required = state.required;
		if (this.#focused) {
			this.#wasFocused = true;
		}
	}

	#synchronizeRelationships(): void {
		const control = this.#control;
		if (!control) {
			return;
		}

		const controlId = this.#id(control, "control");
		if (this.#label) {
			this.#attributes.own(this.#label, "for", controlId);
		}

		const descriptionIds = this.#descriptions.map((element) => this.#id(element, "description"));
		const errorIds = this.#errors.map((element) => this.#id(element, "error"));
		this.#tokens.own(control, "aria-describedby", descriptionIds);
		this.#tokens.own(control, "aria-errormessage", errorIds);

		if (this.#invalid && this.#attributes.authorValue(control, "aria-invalid") === null) {
			this.#attributes.own(control, "aria-invalid", "true");
		} else {
			this.#attributes.releaseAttribute(control, "aria-invalid");
		}
	}

	#id(element: HTMLElement, part: "control" | "description" | "error"): string {
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
				id = `${this.localName || "aui-field"}-${part}-${++generatedId}`;
			} while (root.getElementById(id));
			this.#ids.set(element, id);
		}
		this.#attributes.own(element, "id", id);
		return id;
	}

	#releaseRelationships(): void {
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
		] as const) {
			if (present) {
				this.#internals.states.add(state);
			} else {
				this.#internals.states.delete(state);
			}
		}
	}
}

class AttributeOwner {
	#attributes = new Map<Element, Map<string, OwnedAttribute>>();

	authorValue(element: Element, name: string): AttributeValue {
		return this.#capture(element, name).author;
	}

	own(element: Element, name: string, value: AttributeValue): void {
		const state = this.#capture(element, name);
		const current = element.getAttribute(name);
		if (current !== value) {
			if (value === null) {
				element.removeAttribute(name);
			} else {
				element.setAttribute(name, value);
			}
		}
		state.owned = value;
	}

	releaseAttribute(element: Element, name: string): void {
		const attributes = this.#attributes.get(element);
		const state = attributes?.get(name);
		if (!attributes || !state) {
			return;
		}

		const current = element.getAttribute(name);
		if (current === state.owned && current !== state.author) {
			if (state.author === null) {
				element.removeAttribute(name);
			} else {
				element.setAttribute(name, state.author);
			}
		}
		attributes.delete(name);
		if (attributes.size === 0) {
			this.#attributes.delete(element);
		}
	}

	release(element: Element): void {
		for (const name of [...(this.#attributes.get(element)?.keys() ?? [])]) {
			this.releaseAttribute(element, name);
		}
	}

	#capture(element: Element, name: string): OwnedAttribute {
		let attributes = this.#attributes.get(element);
		if (!attributes) {
			this.#attributes.set(element, (attributes = new Map()));
		}

		const current = element.getAttribute(name);
		let state = attributes.get(name);
		if (!state) {
			state = { author: current, owned: current };
			attributes.set(name, state);
		} else if (current !== state.owned) {
			state.author = current;
		}

		return state;
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
