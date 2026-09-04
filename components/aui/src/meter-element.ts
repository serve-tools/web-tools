import { upgradeProperty } from "./.upgrade.js";
import { AUIElement } from "./aui-element.js";

/** A passive meter whose host owns accessibility and whose native meter owns numeric parsing. */
export class MeterElement extends AUIElement {
	static readonly observedAttributes = ["high", "low", "max", "min", "optimum", "value"];

	#internals = this.attachInternals();
	#meter = this.ownerDocument.createElement("meter");

	constructor() {
		super();

		this.#internals.role = "meter";
		this.#meter.setAttribute("aria-hidden", "true");
		this.#meter.setAttribute("part", "meter");

		for (const property of ["high", "low", "max", "min", "optimum", "value"] as const) {
			upgradeProperty(this, property);
		}
		for (const attribute of MeterElement.observedAttributes) {
			this.#copyAttribute(attribute);
		}
		this.#synchronize();
	}

	/** The native visual meter and numeric parsing oracle. It is hidden from the accessibility tree. */
	get meter(): HTMLMeterElement {
		return this.#meter;
	}

	get min(): number {
		return this.#meter.min;
	}

	set min(value: number) {
		this.#setNumber("min", value);
	}

	get max(): number {
		return this.#meter.max;
	}

	set max(value: number) {
		this.#setNumber("max", value);
	}

	get value(): number {
		return this.#meter.value;
	}

	set value(value: number) {
		this.#setNumber("value", value);
	}

	get low(): number {
		return this.#meter.low;
	}

	set low(value: number) {
		this.#setNumber("low", value);
	}

	get high(): number {
		return this.#meter.high;
	}

	set high(value: number) {
		this.#setNumber("high", value);
	}

	get optimum(): number {
		return this.#meter.optimum;
	}

	set optimum(value: number) {
		this.#setNumber("optimum", value);
	}

	attributeChangedCallback(name: string): void {
		this.#copyAttribute(name);
		this.#synchronize();
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout(content: DocumentFragment): void {
		content.append(this.#meter, this.ownerDocument.createElement("slot"));
	}

	#copyAttribute(name: string): void {
		const value = this.getAttribute(name);
		if (value === null) {
			this.#meter.removeAttribute(name);
		} else {
			this.#meter.setAttribute(name, value);
		}
	}

	#setNumber(property: "high" | "low" | "max" | "min" | "optimum" | "value", value: number): void {
		this.#meter[property] = value;
		const attribute = this.#meter.getAttribute(property);
		if (attribute === null) {
			this.removeAttribute(property);
		} else {
			this.setAttribute(property, attribute);
		}
		this.#synchronize();
	}

	#synchronize(): void {
		this.#internals.ariaValueMin = String(this.#meter.min);
		this.#internals.ariaValueMax = String(this.#meter.max);
		this.#internals.ariaValueNow = String(this.#meter.value);

		const quality = this.#quality();
		for (const state of ["optimum", "suboptimal", "even-less-good"] as const) {
			if (quality === state) {
				this.#internals.states.add(state);
			} else {
				this.#internals.states.delete(state);
			}
		}
	}

	#quality(): "optimum" | "suboptimal" | "even-less-good" {
		const { high, low, optimum, value } = this.#meter;
		if (optimum < low) {
			return value <= low ? "optimum" : value <= high ? "suboptimal" : "even-less-good";
		}
		if (optimum > high) {
			return value >= high ? "optimum" : value >= low ? "suboptimal" : "even-less-good";
		}
		return value >= low && value <= high ? "optimum" : "suboptimal";
	}
}
