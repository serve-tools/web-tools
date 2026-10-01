import { setCustomState } from "./_states.js";
import { upgradeProperty } from "./_upgrade.js";
import type { BaseElement } from "./BaseElement.js";
import { FormAssociatedElement } from "./FormAssociatedElement.js";
import type { TemplateResult } from "./template.js";
import { html } from "./template.js";

/** Text-entry intent, independent of the underlying native editor type. */
export type TextFieldType = "text" | "email" | "url" | "tel" | "search" | "password";

const attributes = [
	"label",
	"description",
	"error",
	"type",
	"aria-label",
	"placeholder",
	"autocomplete",
	"inputmode",
	"autocapitalize",
	"spellcheck",
	"minlength",
	"maxlength",
	"pattern",
	"rows",
	"cols",
	"wrap",
	"multiple",
	"readonly",
	"required",
	"disabled",
	"multiline",
	"revealed",
	"show-error",
	"value",
];
const validityKeys = [
	"valueMissing",
	"typeMismatch",
	"patternMismatch",
	"tooLong",
	"tooShort",
	"rangeUnderflow",
	"rangeOverflow",
	"stepMismatch",
	"badInput",
	"customError",
] as const;

/** A form-associated text editor with an owned shadow label, validation, and optional CSS masking. */
export class TextFieldElement extends FormAssociatedElement {
	static readonly observedAttributes = attributes;
	#input: HTMLInputElement | HTMLTextAreaElement | null = null;
	#value = "";
	#valueDirty = false;
	#disabled = false;
	#dirty = false;
	#touched = false;
	#reported = false;
	#probe: HTMLInputElement | undefined;
	#configure = true;
	#sections: { name: "label" | "description" | "error"; slot: HTMLSlotElement; group: HTMLElement }[] = [];
	#labelActions: HTMLSlotElement | undefined;

	constructor() {
		super();
		for (const key of [
			"value",
			"defaultValue",
			"type",
			"label",
			"description",
			"error",
			"multiline",
			"revealed",
			"showError",
			"disabled",
			"readOnly",
			"required",
		]) {
			upgradeProperty(this, key);
		}
	}

	/** The owned editor, available after first connection. */
	get input(): HTMLInputElement | HTMLTextAreaElement | null {
		return this.#input;
	}

	/** Current text, never reflected into an attribute. */
	get value(): string {
		return this.#input?.value ?? this.#value;
	}
	set value(value: string) {
		this.#valueDirty = true;
		this.#value = String(value);
		if (this.#input) {
			this.#input.value = this.#value;
		}
		this.#sync();
	}

	/** The value restored by form reset. */
	get defaultValue(): string {
		return this.getAttribute("value") ?? "";
	}
	set defaultValue(value: string) {
		this.setAttribute("value", String(value));
	}

	/** Text-entry intent; the single-line editor always retains native type text. */
	get type(): TextFieldType {
		const type = this.getAttribute("type");
		return type === "email" || type === "url" || type === "tel" || type === "search" || type === "password"
			? type
			: "text";
	}
	set type(value: TextFieldType) {
		this.setAttribute("type", value);
	}

	/** Plain-text label fallback. */
	get label(): string {
		return this.getAttribute("label") ?? "";
	}
	set label(value: string) {
		this.setAttribute("label", value);
	}

	/** Plain-text description fallback. */
	get description(): string {
		return this.getAttribute("description") ?? "";
	}
	set description(value: string) {
		this.setAttribute("description", value);
	}

	/** Presentation override for the native validation message. */
	get error(): string {
		return this.getAttribute("error") ?? "";
	}
	set error(value: string) {
		this.setAttribute("error", value);
	}

	/** Uses a textarea while preserving text and selection where possible. */
	get multiline(): boolean {
		return this.hasAttribute("multiline");
	}
	set multiline(value: boolean) {
		this.toggleAttribute("multiline", value);
	}

	/** Reveals password text without replacing or changing the editor's type. */
	get revealed(): boolean {
		return this.hasAttribute("revealed");
	}
	set revealed(value: boolean) {
		this.toggleAttribute("revealed", value);
	}

	/** Reveals validation feedback while invalid, including before interaction. */
	get showError(): boolean {
		return this.hasAttribute("show-error");
	}
	set showError(value: boolean) {
		this.toggleAttribute("show-error", value);
	}

	/** Whether validation feedback is currently shown. */
	get errorVisible(): boolean {
		return this.invalid && (this.showError || this.#touched || this.#reported);
	}

	/** Whether a user edit has occurred since reset. */
	get dirty(): boolean {
		return this.#dirty;
	}

	/** Whether the field has lost focus since reset. */
	get touched(): boolean {
		return this.#touched;
	}

	/** Whether the field currently fails applicable constraints. */
	get invalid(): boolean {
		return this.willValidate && !this.validity.valid;
	}

	/** Whether the field contains text. */
	get filled(): boolean {
		return this.value !== "";
	}

	/** Current selection start. */
	get selectionStart(): number | null {
		return this.#input?.selectionStart ?? null;
	}
	set selectionStart(value: number | null) {
		if (this.#input) {
			this.#input.selectionStart = value;
		}
	}

	/** Current selection end. */
	get selectionEnd(): number | null {
		return this.#input?.selectionEnd ?? null;
	}
	set selectionEnd(value: number | null) {
		if (this.#input) {
			this.#input.selectionEnd = value;
		}
	}

	/** Focuses the owned editor. */
	override focus(options?: FocusOptions): void {
		this.#input?.focus(options);
	}

	/** Selects all editor text. */
	select(): void {
		this.#input?.select();
	}

	/** Sets a native text selection. */
	setSelectionRange(start: number, end: number, direction?: "forward" | "backward" | "none"): void {
		this.#input?.setSelectionRange(start, end, direction);
	}

	/** Clears interaction history without changing value or custom validity. */
	resetState(): void {
		this.#dirty = this.#touched = this.#reported = false;
		this.#sync();
	}

	/** Synchronizes attributes and constraints after direct editor changes. */
	refresh(): void {
		this.#sync();
	}

	attributeChangedCallback(name: string): void {
		this.#configure = true;
		if (name === "value" && !this.#valueDirty) {
			this.#value = this.defaultValue;
			if (this.#input) {
				this.#input.value = this.#value;
			}
		}
		if (name === "multiline" && this.#input) {
			this.#createInput();
		}
		this.#sync();
	}

	formDisabledCallback(disabled: boolean): void {
		this.#disabled = disabled;
		this.#configure = true;
		this.#sync();
	}

	formResetCallback(): void {
		this.#valueDirty = false;
		this.#value = this.defaultValue;
		if (this.#input) {
			this.#input.value = this.#value;
		}
		this.resetState();
	}

	formStateRestoreCallback(state: string | File | FormData): void {
		if (typeof state === "string") {
			this.value = state;
			this.resetState();
		}
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.shadowRoot ?? this.attachShadow({ mode: "open", delegatesFocus: true });
	}

	protected override layout(): TemplateResult {
		return html`
			<style>
				:host { display: inline-block; }
				:host([hidden]), [hidden] { display: none !important; }
				[part="content"] { display: grid; }
				[part="label-content"], [part="control-content"] { display: flex; align-items: center; }
				[part="control"] { min-width: 0; flex: 1; font: inherit; color: inherit; text-align: inherit; }
				[part="description"], [part="error"] { margin: 0; }
				[part="control"].masked { -webkit-text-security: disc; }
			</style>
			<div part="content">
				<div part="label-content">
					<label part="label" for="control"><slot name="label"></slot></label>
					<slot name="label-actions" part="label-actions"></slot>
				</div>
				<div part="control-content">
					<slot name="before" part="before"></slot>
					<slot name="after" part="after"></slot>
				</div>
				<div part="description-content">
					<p part="description" id="description"><slot name="description"></slot></p>
				</div>
				<div part="error-content">
					<p part="error" id="error"><slot name="error"></slot></p>
				</div>
			</div>
		`;
	}

	protected override connect(connection: BaseElement.Connection): void {
		if (!this.#input) {
			this.#sections = (["label", "description", "error"] as const).map((name) => ({
				name,
				slot: this.shadowRoot!.querySelector<HTMLSlotElement>(`slot[name=${name}]`)!,
				group: this.shadowRoot!.querySelector<HTMLElement>(`[part=${name}-content]`)!,
			}));
			this.#labelActions = this.shadowRoot!.querySelector<HTMLSlotElement>('[name="label-actions"]')!;
			this.#createInput();
		}
		const options = { signal: connection.signal };
		this.shadowRoot!.addEventListener(
			"input",
			(event) => {
				if (event.target !== this.#input) {
					return;
				}
				this.#valueDirty = this.#dirty = true;
				this.#sync();
			},
			options,
		);
		this.shadowRoot!.addEventListener(
			"change",
			(event) => {
				if (event.target === this.#input && !event.composed) {
					this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
				}
			},
			options,
		);
		this.addEventListener(
			"focusout",
			() => {
				queueMicrotask(() => {
					if (!connection.signal.aborted && !this.matches(":focus-within")) {
						this.#touched = true;
						this.#sync();
					}
				});
			},
			options,
		);
		this.addEventListener(
			"invalid",
			() => {
				this.#reported = true;
				this.#sync();
			},
			options,
		);
		this.addEventListener(
			"keydown",
			(event) => {
				const input = this.#input;
				const form = this.form;
				if (
					event.key !== "Enter" ||
					event.isComposing ||
					event.defaultPrevented ||
					this.multiline ||
					!input ||
					input.disabled ||
					!form ||
					event.composedPath()[0] !== input
				) {
					return;
				}
				// Native events may run microtasks before ancestor handlers can cancel.
				setTimeout(() => {
					if (
						connection.signal.aborted ||
						event.defaultPrevented ||
						this.#input !== input ||
						this.form !== form ||
						this.multiline ||
						input.disabled
					) {
						return;
					}
					const buttons = (form.getRootNode() as Document | ShadowRoot).querySelectorAll<
						HTMLInputElement | HTMLButtonElement
					>("button,input");
					for (const button of buttons) {
						if (button.form === form && (button.type === "submit" || button.type === "image")) {
							if (!button.matches(":disabled")) {
								button.click();
							}
							return;
						}
					}
					let blocking = 0;
					for (const control of form.elements) {
						if (
							(control instanceof TextFieldElement && !control.multiline) ||
							(control.localName === "input" &&
								/^(text|search|url|tel|email|password|date|month|week|time|datetime-local|number)$/.test(
									(control as HTMLInputElement).type,
								))
						) {
							++blocking;
						}
					}
					if (blocking <= 1) {
						form.requestSubmit();
					}
				});
			},
			options,
		);
		this.shadowRoot!.addEventListener("slotchange", () => this.#sync(), options);
		this.#sync();
	}

	protected override synchronizeValidity(): void {
		this.#sync();
	}

	#createInput(): void {
		const previous = this.#input;
		const focused = previous === this.shadowRoot!.activeElement;
		const start = previous?.selectionStart;
		const end = previous?.selectionEnd;
		const input = this.ownerDocument.createElement(this.multiline ? "textarea" : "input");
		input.id = "control";
		input.setAttribute("part", "control");
		input.value = this.value;
		if (previous) {
			previous.replaceWith(input);
		} else {
			this.shadowRoot!.querySelector('[name="after"]')!.before(input);
		}
		this.#input = input;
		if (focused) {
			input.focus();
		}
		if (start != null && end != null) {
			input.setSelectionRange(start, end, previous?.selectionDirection ?? undefined);
		}
	}

	#sync(): void {
		const input = this.#input;
		if (!input) {
			this.internals.setFormValue(this.#value);
			super.synchronizeValidity();
			return;
		}
		if (this.#configure) {
			this.#configure = false;
			input.classList.toggle("masked", this.type === "password" && !this.revealed);
			for (const name of [
				"aria-label",
				"placeholder",
				"autocomplete",
				"minlength",
				"maxlength",
				"pattern",
				"rows",
				"cols",
				"wrap",
			]) {
				const value = this.getAttribute(name);
				if (value === null) {
					input.removeAttribute(name);
				} else {
					input.setAttribute(name, value);
				}
			}
			input.inputMode =
				this.getAttribute("inputmode") ??
				(this.type === "password" || this.type === "text" ? "text" : this.type);
			input.autocapitalize =
				this.getAttribute("autocapitalize") ??
				(this.type === "text" || this.type === "search" ? "sentences" : "none");
			input.spellcheck = this.hasAttribute("spellcheck")
				? this.getAttribute("spellcheck") !== "false"
				: this.type === "text" || this.type === "search";
			input.disabled = this.#disabled || this.disabled;
			input.readOnly = this.readOnly;
			input.required = this.required;
		}
		input.setCustomValidity(this.customValidity);
		const flags: ValidityStateFlags = {};
		let message = input.validationMessage || this.customValidity;
		for (const key of validityKeys) {
			if (input.validity[key]) {
				flags[key] = true;
			}
		}
		if ((this.type === "email" || this.type === "url") && !input.disabled && !input.readOnly) {
			const probe = (this.#probe ??= this.ownerDocument.createElement("input"));
			probe.type = this.type;
			probe.multiple = this.hasAttribute("multiple");
			probe.value = input.value;
			if (probe.validity.typeMismatch || /[\r\n]/.test(input.value)) {
				flags.typeMismatch = true;
				if (!message) {
					message = probe.validationMessage || "Please enter a single-line " + this.type + " value.";
				}
			}
		}
		this.internals.setValidity(flags, message, input);
		this.internals.setFormValue(input.disabled ? null : input.value, input.value);
		for (const { name, slot, group } of this.#sections) {
			const text = name === "error" ? this.error || this.validationMessage : this[name];
			if (slot.textContent !== text) {
				slot.textContent = text;
			}
			const present = slot.assignedNodes().length > 0 || Boolean(text);
			group.hidden =
				name === "error"
					? !this.errorVisible || !present
					: !present && !(name === "label" && this.#labelActions!.assignedNodes().length);
		}
		const described = this.#sections[1].group.hidden ? "" : "description";
		input.setAttribute("aria-describedby", [described, this.errorVisible ? "error" : ""].filter(Boolean).join(" "));
		input.setAttribute("aria-invalid", String(this.invalid));
		for (const [state, value] of Object.entries({
			invalid: this.invalid,
			valid: !this.invalid,
			dirty: this.#dirty,
			touched: this.#touched,
			filled: this.filled,
			disabled: input.disabled,
			required: this.required,
			"error-visible": this.errorVisible,
		})) {
			setCustomState(this.internals, state, value);
		}
	}
}
