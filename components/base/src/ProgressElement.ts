import { upgradeProperty } from "./_upgrade.js";
import { BaseElement } from "./BaseElement.js";
import { html } from "./template.js";

/** The current progress state. */
export type ProgressStatus = "indeterminate" | "progressing" | "complete";

/** Passive task progress with native numeric behavior and one host accessibility identity. */
export class ProgressElement extends BaseElement {
	static readonly observedAttributes = ["max", "value"];

	#internals = this.attachInternals();
	#progress = this.ownerDocument.createElement("progress");

	constructor() {
		super();

		this.#internals.role = "progressbar";
		this.#progress.setAttribute("aria-hidden", "true");
		this.#progress.setAttribute("part", "progress");

		for (const property of ["max", "value"] as const) {
			upgradeProperty(this, property);
		}
		for (const attribute of ProgressElement.observedAttributes) {
			this.#copyAttribute(attribute);
		}
		this.#synchronize();
	}

	/** The native visual progress element and numeric parsing oracle. It is hidden from accessibility. */
	get progress(): HTMLProgressElement {
		return this.#progress;
	}

	/** The maximum task value. Native progress semantics normalize invalid and nonpositive attributes to 1. */
	get max(): number {
		return this.#progress.max;
	}

	set max(value: number) {
		this.#setNumber("max", value);
	}

	/** The current value. Read `position` or `status` to distinguish an absent value from determinate zero. */
	get value(): number {
		return this.#progress.value;
	}

	set value(value: number) {
		this.#setNumber("value", value);
	}

	/** The native normalized position, or `-1` while indeterminate. */
	get position(): number {
		return this.#progress.position;
	}

	/** The current determinate, progressing, or completed state. */
	get status(): ProgressStatus {
		if (this.#progress.position < 0) {
			return "indeterminate";
		}
		return this.#progress.value === this.#progress.max ? "complete" : "progressing";
	}

	attributeChangedCallback(name: string): void {
		this.#copyAttribute(name);
		this.#synchronize();
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout() {
		return html`${this.#progress}<slot></slot>`;
	}

	#copyAttribute(name: string): void {
		const value = this.getAttribute(name);
		if (value === null) {
			this.#progress.removeAttribute(name);
		} else {
			this.#progress.setAttribute(name, value);
		}
	}

	#setNumber(property: "max" | "value", value: number): void {
		this.#progress[property] = value;
		const attribute = this.#progress.getAttribute(property);
		if (attribute === null) {
			this.removeAttribute(property);
		} else {
			this.setAttribute(property, attribute);
		}
		this.#synchronize();
	}

	#synchronize(): void {
		const status = this.status;
		this.#internals.ariaValueMin = "0";
		this.#internals.ariaValueMax = String(this.#progress.max);
		this.#internals.ariaValueNow = status === "indeterminate" ? null : String(this.#progress.value);

		for (const state of ["indeterminate", "progressing", "complete"] as const) {
			if (status === state) {
				this.#internals.states.add(state);
			} else {
				this.#internals.states.delete(state);
			}
		}
	}
}
