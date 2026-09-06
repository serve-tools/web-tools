import { NativeFieldElement, setNativeFieldState, synchronizeNativeFieldAttributes } from "./_native-field.js";
import { isDirectInput, isFormElement } from "./_numeric.js";
import { AttributeOwner } from "./_ownership.js";
import { upgradeProperty } from "./_upgrade.js";
import type { BaseElement } from "./BaseElement.js";
import { html } from "./template.js";

/** Coordinates one native one-time-code input with optional inert visual segments. */
export class OTPFieldElement extends NativeFieldElement {
	static readonly observedAttributes = ["disabled", "length", "readonly", "required"];

	#input: HTMLInputElement | undefined;
	#internals = this.attachInternals();
	#owned = new AttributeOwner();
	#pendingValue: string | undefined;
	#segments: Element[] = [];

	constructor() {
		super();

		for (const property of ["disabled", "length", "readOnly", "required", "value"] as const) {
			upgradeProperty(this, property);
		}
	}

	/** The first direct native text, password, or telephone input, which remains the sole editor and form identity. */
	get input(): HTMLInputElement | null {
		this.#refresh();
		return this.#input ?? null;
	}

	/** Direct elements assigned to `slot="segment"`, in author order. */
	get segments(): readonly Element[] {
		this.#refresh();
		return Object.freeze([...this.#segments]);
	}

	/** The exact code length, or zero when native length constraints are left to the input. */
	get length(): number {
		const value = Number(this.getAttribute("length"));
		return Number.isInteger(value) && value > 0 ? value : 0;
	}

	set length(value: number) {
		const number = Number(value);
		if (!Number.isInteger(number) || number <= 0) {
			this.removeAttribute("length");
		} else {
			this.setAttribute("length", String(number));
		}
	}

	/** The current native value. Setting it is silent and does not imitate typing or autofill. */
	get value(): string {
		return this.input?.value ?? this.#pendingValue ?? "";
	}

	set value(value: string) {
		const string = String(value);
		const input = this.input;
		if (input) {
			input.value = string;
			this.#pendingValue = undefined;
			this.#synchronize();
		} else {
			this.#pendingValue = string;
		}
	}

	attributeChangedCallback(): void {
		this.#synchronize();
	}

	protected override layout() {
		return html`<slot></slot><span part="segments" aria-hidden="true" inert><slot name="segment"></slot></span>`;
	}

	protected override connect(connection: BaseElement.Connection): void {
		this.#refresh();
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: [
				"aria-hidden",
				"autocomplete",
				"data-active",
				"data-filled",
				"data-value",
				"disabled",
				"inert",
				"inputmode",
				"maxlength",
				"minlength",
				"readonly",
				"required",
				"slot",
				"type",
			],
			attributes: true,
			childList: true,
			subtree: true,
		});
		connection.addCleanup(() => observer.disconnect());
		for (const type of [
			"beforeinput",
			"input",
			"change",
			"compositionend",
			"select",
			"keyup",
			"click",
			"focusin",
			"focusout",
		]) {
			this.addEventListener(type, this.#onEditorActivity, { capture: true, signal: connection.signal });
		}
		this.ownerDocument.addEventListener("reset", this.#onFormReset, { capture: true, signal: connection.signal });
	}

	#onFormReset = (event: Event): void => {
		if (this.#pendingValue === undefined || !isFormElement(this.ownerDocument, event.target)) {
			return;
		}
		const input = [...this.children].find(
			(child): child is HTMLInputElement =>
				isDirectInput(this, child) &&
				child.slot === "" &&
				(child.type === "text" || child.type === "password" || child.type === "tel"),
		);
		if (input?.form === event.target) {
			this.#refresh();
		}
	};

	#onEditorActivity = (event: Event): void => {
		const input = this.#input;
		if (event.target !== input || !input || event.type === "beforeinput") {
			return;
		}
		if (event.type === "input") {
			queueMicrotask(() => {
				if (
					this.#input === input &&
					input.parentElement === this &&
					input.slot === "" &&
					(input.type === "text" || input.type === "password" || input.type === "tel")
				) {
					this.#synchronize();
				} else {
					this.#refresh();
					const owner = input.parentElement;
					if (owner instanceof OTPFieldElement && owner !== this) {
						owner.#refresh();
					}
				}
			});
		} else {
			this.#refresh();
			const owner = input.parentElement;
			if (owner instanceof OTPFieldElement && owner !== this) {
				owner.#refresh();
			}
		}
	};

	#refresh(): void {
		const children = [...this.children];
		const input = children.find(
			(child): child is HTMLInputElement =>
				isDirectInput(this, child) &&
				child.slot === "" &&
				(child.type === "text" || child.type === "password" || child.type === "tel"),
		);
		const segments = children.filter((child) => child.slot === "segment");

		if (this.#input !== input) {
			if (this.#input) {
				this.#owned.release(this.#input);
			}
			this.#input = input;
			if (input && this.#pendingValue !== undefined) {
				input.value = this.#pendingValue;
				this.#pendingValue = undefined;
			}
		}
		for (const segment of this.#segments) {
			if (!segments.includes(segment)) {
				this.#owned.release(segment);
			}
		}
		this.#segments = segments;
		this.#synchronize();
	}

	#synchronize(): void {
		const input = this.#input;
		if (!input) {
			setNativeFieldState(this.#internals, "disabled", this.disabled);
			setNativeFieldState(this.#internals, "readonly", this.readOnly);
			setNativeFieldState(this.#internals, "complete", false);
			setNativeFieldState(this.#internals, "invalid", false);
			this.#mirrorSegments("");
			return;
		}

		for (const [name, value] of [
			["autocomplete", "one-time-code"],
			["inputmode", "numeric"],
		] as const) {
			if (this.#owned.authorValue(input, name) === null) {
				this.#owned.own(input, name, value);
			} else {
				this.#owned.releaseAttribute(input, name);
			}
		}
		const length = this.length;
		for (const name of ["minlength", "maxlength"] as const) {
			if (length > 0) {
				this.#owned.own(input, name, String(length));
			} else {
				this.#owned.releaseAttribute(input, name);
			}
		}
		synchronizeNativeFieldAttributes(this, input, this.#owned);

		this.#mirrorSegments(input.value);
		setNativeFieldState(this.#internals, "disabled", input.disabled);
		setNativeFieldState(this.#internals, "readonly", input.readOnly);
		setNativeFieldState(this.#internals, "complete", length > 0 && input.value.length === length);
		setNativeFieldState(this.#internals, "invalid", !input.validity.valid);
	}

	#mirrorSegments(value: string): void {
		const input = this.#input;
		const selectionStart = input?.selectionStart ?? -1;
		for (let index = 0; index < this.#segments.length; ++index) {
			const segment = this.#segments[index];
			const character = value.charAt(index);
			this.#owned.own(segment, "aria-hidden", "true");
			this.#owned.own(segment, "inert", "");
			this.#owned.own(segment, "data-value", character);
			this.#owned.own(segment, "data-filled", character ? "" : null);
			this.#owned.own(
				segment,
				"data-active",
				input === this.ownerDocument.activeElement && selectionStart === index ? "" : null,
			);
		}
	}
}
