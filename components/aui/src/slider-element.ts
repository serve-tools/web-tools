import { isDirectInput, isFormElement } from "./.numeric.js";
import { AttributeOwner } from "./.ownership.js";
import { AUIElement } from "./aui-element.js";

export type SliderOrientation = "horizontal" | "vertical";

/** Coordinates one or more actual native range inputs without replacing their form or focus identities. */
export class SliderElement extends AUIElement {
	static readonly observedAttributes = ["disabled", "max", "min", "orientation", "step"];

	#inputs: HTMLInputElement[] = [];
	#internals = this.attachInternals();
	#owned = new AttributeOwner();
	#pendingFirstValue: number | undefined;
	#pendingValues: readonly number[] | undefined;
	#recovering = true;
	#track = this.ownerDocument.createElement("span");
	#variableCount = 0;

	constructor() {
		super();

		this.#track.setAttribute("part", "track");
		const properties = ["disabled", "max", "min", "orientation", "step", "value", "values"] as const;
		const record = this as unknown as Record<(typeof properties)[number], unknown>;
		const recovered: Array<readonly [(typeof properties)[number], unknown]> = [];
		const inputCount = this.#directInputs().length;
		for (const property of properties) {
			if (!Object.hasOwn(this, property)) {
				continue;
			}
			const value = this.#normalizeRecovered(property, record[property]);
			if (property === "values" && inputCount > 0 && (value as readonly number[]).length !== inputCount) {
				throw new RangeError(
					`Expected ${inputCount} slider values, received ${(value as readonly number[]).length}`,
				);
			}
			recovered.push([property, value]);
		}
		for (const [property] of recovered) {
			delete record[property];
		}
		try {
			for (const [property, value] of recovered) {
				record[property] = value;
			}
		} finally {
			this.#recovering = false;
		}
	}

	/** Direct native range inputs in author order. Each input keeps its own name, label, focus, and form value. */
	get inputs(): readonly HTMLInputElement[] {
		this.#refresh();
		return Object.freeze([...this.#inputs]);
	}

	/** Current numeric values in input order. Setting them is silent. */
	get values(): readonly number[] {
		this.#refresh();
		return Object.freeze(this.#inputs.map((input) => input.valueAsNumber));
	}

	set values(values: readonly number[]) {
		const numbers = Array.from(values, (value) => this.#toNativeNumber(value));
		if (!this.#recovering) {
			const inputCount = this.#directInputs().length;
			if (inputCount > 0 && numbers.length !== inputCount) {
				throw new RangeError(`Expected ${inputCount} slider values, received ${numbers.length}`);
			}
			this.#refresh();
		}
		if (this.#inputs.length === 0) {
			this.#pendingValues = numbers;
			this.#pendingFirstValue = undefined;
			return;
		}
		if (numbers.length !== this.#inputs.length) {
			throw new RangeError(`Expected ${this.#inputs.length} slider values, received ${numbers.length}`);
		}
		this.#pendingValues = undefined;
		this.#pendingFirstValue = undefined;
		this.#setValues(numbers);
	}

	/** The first range input's numeric value. Setting it is silent. */
	get value(): number {
		return this.inputs[0]?.valueAsNumber ?? Number.NaN;
	}

	set value(value: number) {
		const number = this.#toNativeNumber(value);
		if (this.#recovering) {
			this.#pendingFirstValue = number;
			return;
		}
		const inputs = this.inputs;
		if (inputs.length === 0) {
			if (this.#pendingValues && this.#pendingValues.length > 0) {
				this.#pendingValues = [number, ...this.#pendingValues.slice(1)];
			} else {
				this.#pendingFirstValue = number;
			}
			return;
		}
		const values = inputs.map((input) => input.valueAsNumber);
		values[0] = number;
		if (this.#pendingValues && this.#pendingValues.length > 0) {
			this.#pendingValues = [number, ...this.#pendingValues.slice(1)];
		}
		this.#setValues(values);
	}

	get min(): string {
		return this.getAttribute("min") ?? "";
	}

	set min(value: string) {
		this.setAttribute("min", String(value));
	}

	get max(): string {
		return this.getAttribute("max") ?? "";
	}

	set max(value: string) {
		this.setAttribute("max", String(value));
	}

	get step(): string {
		return this.getAttribute("step") ?? "";
	}

	set step(value: string) {
		this.setAttribute("step", String(value));
	}

	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	get orientation(): SliderOrientation {
		return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";
	}

	set orientation(value: SliderOrientation) {
		this.setAttribute("orientation", value === "vertical" ? "vertical" : "horizontal");
	}

	/** Whether this slider currently coordinates more than one actual range input. */
	get multiple(): boolean {
		return this.inputs.length > 1;
	}

	attributeChangedCallback(): void {
		this.#synchronize();
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout(content: DocumentFragment): void {
		const style = this.ownerDocument.createElement("style");
		style.textContent = `
			:host { display: inline-block; }
			[part="track"] { display: inline-grid; gap: 0.5rem; position: relative; }
			:host([orientation="vertical"]) [part="track"] { grid-auto-flow: column; }
			:host([orientation="vertical"]) ::slotted(input[type="range"]) {
				direction: rtl;
				writing-mode: vertical-lr;
			}
		`;
		const thumbs = this.ownerDocument.createElement("slot");
		thumbs.name = "thumb";
		const ranges = this.ownerDocument.createElement("slot");
		this.#track.append(thumbs, ranges);
		content.append(style, this.#track);
	}

	protected override connect(connection: AUIElement.Connection): void {
		this.#refresh();
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: ["aria-orientation", "disabled", "max", "min", "slot", "step", "type", "value"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		this.addEventListener("input", this.#onNativeEdit, { capture: true, signal: connection.signal });
		this.addEventListener("change", this.#onNativeEdit, { capture: true, signal: connection.signal });
		this.ownerDocument.addEventListener("reset", this.#onFormReset, { capture: true, signal: connection.signal });
		connection.addCleanup(() => observer.disconnect());
	}

	#onFormReset = (event: Event): void => {
		if (
			(this.#pendingValues === undefined && this.#pendingFirstValue === undefined) ||
			!isFormElement(this.ownerDocument, event.target)
		) {
			return;
		}
		const inputs = this.#directInputs();
		if (!inputs.some((input) => input.form === event.target)) {
			return;
		}
		if (this.#pendingValues && this.#pendingValues.length !== inputs.length) {
			this.#pendingValues = undefined;
			this.#pendingFirstValue = undefined;
		}
		this.#refresh();
	};

	#onNativeEdit = (event: Event): void => {
		const input = event.target as HTMLInputElement;
		if (this.#inputs.includes(input)) {
			this.#refresh();
			const owner = input.parentElement;
			if (owner instanceof SliderElement && owner !== this) {
				owner.#refresh();
			}
		}
	};

	#refresh(): void {
		const inputs = this.#directInputs();
		for (const input of this.#inputs) {
			if (!inputs.includes(input)) {
				this.#owned.release(input);
			}
		}
		this.#inputs = inputs;

		if (inputs.length > 0 && this.#pendingValues?.length === inputs.length) {
			const pending = this.#pendingValues;
			this.#pendingValues = undefined;
			this.#pendingFirstValue = undefined;
			this.#setValues(pending);
		} else if (inputs.length > 0 && this.#pendingFirstValue !== undefined) {
			const first = this.#pendingFirstValue;
			this.#pendingFirstValue = undefined;
			const values = inputs.map((input) => input.valueAsNumber);
			values[0] = first;
			this.#setValues(values);
		} else {
			this.#synchronize();
		}
	}

	#directInputs(): HTMLInputElement[] {
		return [...this.children].filter(
			(child): child is HTMLInputElement => isDirectInput(this, child) && child.type === "range",
		);
	}

	#normalizeRecovered(
		property: "disabled" | "max" | "min" | "orientation" | "step" | "value" | "values",
		value: unknown,
	): unknown {
		if (property === "disabled") {
			return Boolean(value);
		}
		if (property === "value") {
			return this.#toNativeNumber(value as number);
		}
		if (property === "values") {
			return Array.from(value as readonly number[], (item) => this.#toNativeNumber(item));
		}
		return String(value);
	}

	#setValues(values: readonly number[]): void {
		const { maximum, minimum } = this.#outerBounds();
		for (const input of this.#inputs) {
			this.#owned.own(input, "min", String(minimum));
			this.#owned.own(input, "max", String(maximum));
		}

		let floor = minimum;
		for (let index = 0; index < this.#inputs.length; ++index) {
			const input = this.#inputs[index];
			input.valueAsNumber = Math.min(maximum, Math.max(floor, values[index]));
			floor = input.valueAsNumber;
		}
		this.#synchronize();
	}

	#synchronize(): void {
		const inputs = this.#inputs;
		if (inputs.length === 0) {
			this.#setState("disabled", this.disabled);
			this.#setState("multiple", false);
			this.#setState("vertical", this.orientation === "vertical");
			this.#updateVariables([], 0, 100);
			return;
		}

		const { maximum, minimum } = this.#outerBounds();
		const values: number[] = [];
		let floor = minimum;
		for (const input of inputs) {
			const value = Math.min(maximum, Math.max(floor, input.valueAsNumber));
			if (input.valueAsNumber !== value) {
				input.valueAsNumber = value;
			}
			values.push(input.valueAsNumber);
			floor = input.valueAsNumber;
		}

		for (let index = 0; index < inputs.length; ++index) {
			const input = inputs[index];
			this.#owned.own(input, "min", String(index === 0 ? minimum : values[index - 1]));
			this.#owned.own(input, "max", String(index === inputs.length - 1 ? maximum : values[index + 1]));
			if (this.hasAttribute("step")) {
				this.#owned.own(input, "step", this.getAttribute("step"));
			} else {
				this.#owned.releaseAttribute(input, "step");
			}
			if (this.disabled) {
				this.#owned.own(input, "disabled", "");
			} else {
				this.#owned.releaseAttribute(input, "disabled");
			}
			if (this.orientation === "vertical") {
				this.#owned.own(input, "aria-orientation", "vertical");
			} else {
				this.#owned.releaseAttribute(input, "aria-orientation");
			}
		}

		this.#updateVariables(values, minimum, maximum);
		this.#setState(
			"disabled",
			inputs.every((input) => input.disabled),
		);
		this.#setState("multiple", inputs.length > 1);
		this.#setState("vertical", this.orientation === "vertical");
	}

	#outerBounds(): { maximum: number; minimum: number } {
		const first = this.#inputs[0];
		const minimumAttribute = this.getAttribute("min") ?? (first ? this.#owned.authorValue(first, "min") : null);
		const maximumAttribute = this.getAttribute("max") ?? (first ? this.#owned.authorValue(first, "max") : null);
		const oracle = this.ownerDocument.createElement("input");
		oracle.type = "range";
		oracle.step = "any";
		if (minimumAttribute !== null) {
			oracle.setAttribute("min", minimumAttribute);
		}
		if (maximumAttribute !== null) {
			oracle.setAttribute("max", maximumAttribute);
		}
		oracle.value = "-1e308";
		const minimum = oracle.valueAsNumber;
		oracle.value = "1e308";
		return { maximum: oracle.valueAsNumber, minimum };
	}

	#toNativeNumber(value: number): number {
		const oracle = this.ownerDocument.createElement("input");
		oracle.type = "number";
		oracle.valueAsNumber = value;
		return oracle.valueAsNumber;
	}

	#updateVariables(values: readonly number[], minimum: number, maximum: number): void {
		const span = maximum - minimum;
		for (let index = 0; index < values.length; ++index) {
			const percent = span === 0 ? 0 : ((values[index] - minimum) / span) * 100;
			this.#track.style.setProperty(`--aui-slider-value-${index}`, `${percent}%`);
		}
		for (let index = values.length; index < this.#variableCount; ++index) {
			this.#track.style.removeProperty(`--aui-slider-value-${index}`);
		}
		this.#variableCount = values.length;
		this.#track.style.setProperty("--aui-slider-min", String(minimum));
		this.#track.style.setProperty("--aui-slider-max", String(maximum));
	}

	#setState(state: string, present: boolean): void {
		if (present) {
			this.#internals.states.add(state);
		} else {
			this.#internals.states.delete(state);
		}
	}
}
