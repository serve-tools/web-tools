import { isDirectInput, isFormElement, OwnedAttributes, upgradeProperty } from "./.numeric.js";
import { AUIElement } from "./aui-element.js";

/** Coordinates one native one-time-code input with optional inert visual segments. */
export class OTPFieldElement extends AUIElement {
	static readonly observedAttributes = ["disabled", "length", "readonly", "required"];

	#input: HTMLInputElement | undefined;
	#internals = this.attachInternals();
	#owned = new OwnedAttributes();
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

	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	get readOnly(): boolean {
		return this.hasAttribute("readonly");
	}

	set readOnly(value: boolean) {
		this.toggleAttribute("readonly", Boolean(value));
	}

	get required(): boolean {
		return this.hasAttribute("required");
	}

	set required(value: boolean) {
		this.toggleAttribute("required", Boolean(value));
	}

	get validity(): ValidityState | null {
		return this.input?.validity ?? null;
	}

	get validationMessage(): string {
		return this.input?.validationMessage ?? "";
	}

	checkValidity(): boolean {
		return this.input?.checkValidity() ?? true;
	}

	reportValidity(): boolean {
		return this.input?.reportValidity() ?? true;
	}

	attributeChangedCallback(): void {
		this.#synchronize();
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout(content: DocumentFragment): void {
		const editor = this.ownerDocument.createElement("slot");
		const visuals = this.ownerDocument.createElement("span");
		visuals.setAttribute("part", "segments");
		visuals.setAttribute("aria-hidden", "true");
		visuals.setAttribute("inert", "");
		const segments = this.ownerDocument.createElement("slot");
		segments.name = "segment";
		visuals.append(segments);
		content.append(editor, visuals);
	}

	protected override connect(connection: AUIElement.Connection): void {
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
		connection.addCleanup(() => observer.disconnect());
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
			this.#setState("disabled", this.disabled);
			this.#setState("readonly", this.readOnly);
			this.#setState("complete", false);
			this.#setState("invalid", false);
			this.#mirrorSegments("");
			return;
		}

		for (const [name, value] of [
			["autocomplete", "one-time-code"],
			["inputmode", "numeric"],
		] as const) {
			if (this.#owned.author(input, name) === null) {
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
		for (const name of ["disabled", "readonly", "required"] as const) {
			if (this.hasAttribute(name)) {
				this.#owned.own(input, name, "");
			} else {
				this.#owned.releaseAttribute(input, name);
			}
		}

		this.#mirrorSegments(input.value);
		this.#setState("disabled", input.disabled);
		this.#setState("readonly", input.readOnly);
		this.#setState("complete", length > 0 && input.value.length === length);
		this.#setState("invalid", !input.validity.valid);
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

	#setState(state: string, present: boolean): void {
		if (present) {
			this.#internals.states.add(state);
		} else {
			this.#internals.states.delete(state);
		}
	}
}
