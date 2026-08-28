import { isDirectButton, isDirectInput, isFormElement, OwnedAttributes } from "./.numeric.js";
import { AUIElement } from "./aui-element.js";

/** Immutable state proposed before an AUI number-field step action. */
export interface NumberFieldChangeDetail {
	/** The native string value that will be committed unless canceled. */
	readonly value: string;

	/** The corresponding native numeric value. */
	readonly valueAsNumber: number;

	/** The direction of the requested step. */
	readonly direction: "decrement" | "increment";

	/** The authored button event that initiated the action. */
	readonly sourceEvent: MouseEvent | PointerEvent;
}

/** Events emitted by a number field for its additional stepping behavior. */
export interface NumberFieldEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<NumberFieldChangeDetail>;
}

const repeatDelay = 400;
const repeatInterval = 75;

/** Coordinates an authored native number input and optional native step buttons. */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: the interface adds typed DOM event overloads only.
export class NumberFieldElement extends AUIElement {
	static readonly observedAttributes = ["disabled", "max", "min", "readonly", "required", "step"];

	#activeChanged = false;
	#activePointer: number | undefined;
	#connectionSignal: AbortSignal | undefined;
	#clickCleanup: (() => void) | undefined;
	#changing = false;
	#decrementButton: HTMLButtonElement | undefined;
	#incrementButton: HTMLButtonElement | undefined;
	#input: HTMLInputElement | undefined;
	#internals = this.attachInternals();
	#owned = new OwnedAttributes();
	#pendingValue: string | undefined;
	#repeatCleanup: (() => void) | undefined;
	#recovering = true;
	#suppressClick: HTMLButtonElement | undefined;

	constructor() {
		super();

		const properties = [
			"disabled",
			"max",
			"min",
			"readOnly",
			"required",
			"step",
			"value",
			"valueAsNumber",
		] as const;
		const record = this as unknown as Record<(typeof properties)[number], unknown>;
		const recovered: Array<readonly [(typeof properties)[number], unknown]> = [];
		for (const property of properties) {
			if (Object.hasOwn(this, property)) {
				recovered.push([property, this.#normalizeRecovered(property, record[property])]);
			}
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

	/** The first direct native number input, which owns editing, focus, validation, and form submission. */
	get input(): HTMLInputElement | null {
		this.#refresh();
		return this.#input ?? null;
	}

	/** The first direct native button assigned to `slot="decrement"`. */
	get decrementButton(): HTMLButtonElement | null {
		this.#refresh();
		return this.#decrementButton ?? null;
	}

	/** The first direct native button assigned to `slot="increment"`. */
	get incrementButton(): HTMLButtonElement | null {
		this.#refresh();
		return this.#incrementButton ?? null;
	}

	/** The current native string value. Setting it is silent. */
	get value(): string {
		return this.input?.value ?? this.#pendingValue ?? "";
	}

	set value(value: string) {
		const string = String(value);
		if (this.#recovering) {
			this.#pendingValue = this.#numberString(string);
			return;
		}
		const input = this.input;
		if (input) {
			input.value = string;
			this.#pendingValue = undefined;
			this.#synchronize();
		} else {
			const oracle = this.ownerDocument.createElement("input");
			oracle.type = "number";
			oracle.value = string;
			this.#pendingValue = oracle.value;
		}
	}

	/** The current native numeric value. Setting it is silent and uses native Web IDL conversion. */
	get valueAsNumber(): number {
		return this.input?.valueAsNumber ?? Number.NaN;
	}

	set valueAsNumber(value: number) {
		if (this.#recovering) {
			this.#pendingValue = this.#numberValue(value).value;
			return;
		}
		const input = this.input;
		if (!input) {
			const oracle = this.ownerDocument.createElement("input");
			oracle.type = "number";
			oracle.valueAsNumber = value;
			this.#pendingValue = oracle.value;
			return;
		}
		input.valueAsNumber = value;
		this.#pendingValue = undefined;
		this.#synchronize();
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

	/** Silently invokes the native input's `stepUp()`. */
	stepUp(increment?: number): void {
		this.input?.stepUp(increment);
		this.#synchronize();
	}

	/** Silently invokes the native input's `stepDown()`. */
	stepDown(increment?: number): void {
		this.input?.stepDown(increment);
		this.#synchronize();
	}

	attributeChangedCallback(): void {
		this.#synchronize();
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout(content: DocumentFragment): void {
		const decrement = this.ownerDocument.createElement("slot");
		decrement.name = "decrement";
		const input = this.ownerDocument.createElement("slot");
		const increment = this.ownerDocument.createElement("slot");
		increment.name = "increment";
		content.append(decrement, input, increment);
	}

	protected override connect(connection: AUIElement.Connection): void {
		this.#connectionSignal = connection.signal;
		this.#refresh();
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#refresh());
		observer.observe(this, {
			attributeFilter: ["disabled", "max", "min", "readonly", "required", "slot", "step", "type"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		this.addEventListener("pointerdown", this.#onPointerDown, { capture: true, signal: connection.signal });
		this.addEventListener("click", this.#onClick, { capture: true, signal: connection.signal });
		this.addEventListener("input", this.#onNativeInput, { capture: true, signal: connection.signal });
		this.ownerDocument.addEventListener("reset", this.#onFormReset, { capture: true, signal: connection.signal });
		connection.addCleanup(() => {
			observer.disconnect();
			if (this.#connectionSignal === connection.signal) {
				this.#connectionSignal = undefined;
			}
			this.#stopRepeat(false, this.#changing && this.#suppressClick !== undefined);
		});
	}

	#onNativeInput = (event: Event): void => {
		const input = event.target as HTMLInputElement | null;
		if (input === this.#input) {
			this.#refresh();
			const owner = input.parentElement;
			if (owner instanceof NumberFieldElement && owner !== this) {
				owner.#refresh();
			}
		}
	};

	#onFormReset = (event: Event): void => {
		if (this.#pendingValue === undefined || !isFormElement(this.ownerDocument, event.target)) {
			return;
		}
		const input = [...this.children].find(
			(child): child is HTMLInputElement =>
				isDirectInput(this, child) && child.slot === "" && child.type === "number",
		);
		if (input?.form === event.target) {
			this.#refresh();
		}
	};

	#onPointerDown = (event: PointerEvent): void => {
		if (event.defaultPrevented || event.button !== 0 || this.#activePointer !== undefined || this.#changing) {
			return;
		}
		this.#clickCleanup?.();
		this.#clickCleanup = undefined;
		this.#suppressClick = undefined;
		this.#refresh();
		const action = this.#getAction(event);
		if (!action || !this.#canStep()) {
			return;
		}

		this.#activePointer = event.pointerId;
		this.#suppressClick = action.button;

		const document = this.ownerDocument;
		const window = document.defaultView;
		const Controller = window?.AbortController ?? AbortController;
		const controller = new Controller();
		const setTimeout = window?.setTimeout.bind(window) ?? globalThis.setTimeout;
		const clearTimeout = window?.clearTimeout.bind(window) ?? globalThis.clearTimeout;
		const setInterval = window?.setInterval.bind(window) ?? globalThis.setInterval;
		const clearInterval = window?.clearInterval.bind(window) ?? globalThis.clearInterval;
		let delay: ReturnType<typeof setTimeout> | undefined;
		let interval: ReturnType<typeof setInterval> | undefined;
		const finish = (finishEvent: PointerEvent) => {
			if (finishEvent.pointerId === this.#activePointer) {
				this.#stopRepeat(true);
			}
		};
		document.addEventListener("pointerup", finish, { capture: true, signal: controller.signal });
		document.addEventListener("pointercancel", finish, { capture: true, signal: controller.signal });
		this.#repeatCleanup = () => {
			controller.abort();
			if (delay !== undefined) {
				clearTimeout(delay);
			}
			if (interval !== undefined) {
				clearInterval(interval);
			}
		};

		this.#activeChanged = this.#runStep(action.direction, event);
		if (!this.#isActive()) {
			return;
		}
		if (this.#activeChanged) {
			delay = setTimeout(() => {
				interval = setInterval(() => {
					this.#activeChanged = this.#runStep(action.direction, event) || this.#activeChanged;
				}, repeatInterval);
			}, repeatDelay);
		}
	};

	#onClick = (event: MouseEvent): void => {
		if (event.defaultPrevented || this.#changing) {
			return;
		}
		this.#refresh();
		const action = this.#getAction(event);
		if (!action) {
			return;
		}
		if (this.#suppressClick === action.button && event.detail !== 0) {
			this.#clickCleanup?.();
			this.#clickCleanup = undefined;
			this.#suppressClick = undefined;
			return;
		}
		if (this.#runStep(action.direction, event) && this.#isActive()) {
			this.#runChange();
		}
	};

	#getAction(event: Event): { button: HTMLButtonElement; direction: "decrement" | "increment" } | undefined {
		for (const node of event.composedPath()) {
			if (node === this.#decrementButton) {
				return { button: this.#decrementButton, direction: "decrement" };
			}
			if (node === this.#incrementButton) {
				return { button: this.#incrementButton, direction: "increment" };
			}
		}
		return undefined;
	}

	#canStep(): boolean {
		const input = this.#input;
		return Boolean(this.#isActive() && input && !input.matches(":disabled") && !input.readOnly);
	}

	#isActive(): boolean {
		return Boolean(this.isConnected && this.#connectionSignal && !this.#connectionSignal.aborted);
	}

	#runStep(direction: "decrement" | "increment", sourceEvent: MouseEvent | PointerEvent): boolean {
		if (this.#changing) {
			return false;
		}
		this.#changing = true;
		try {
			return this.#proposeStep(direction, sourceEvent);
		} finally {
			this.#changing = false;
		}
	}

	#runChange(): void {
		if (this.#changing) {
			return;
		}
		this.#changing = true;
		try {
			this.#dispatch("change");
		} finally {
			this.#changing = false;
		}
	}

	#proposeStep(direction: "decrement" | "increment", sourceEvent: MouseEvent | PointerEvent): boolean {
		const input = this.#input;
		if (!input || !this.#canStep()) {
			return false;
		}
		const connectionSignal = this.#connectionSignal;
		const document = this.ownerDocument;

		const oracle = this.ownerDocument.createElement("input");
		oracle.type = "number";
		oracle.defaultValue = input.defaultValue;
		oracle.value = input.value;
		oracle.min = input.min;
		oracle.max = input.max;
		oracle.step = input.step === "any" ? "1" : input.step;
		if (direction === "increment") {
			oracle.stepUp();
		} else {
			oracle.stepDown();
		}
		if (oracle.value === input.value) {
			return false;
		}
		const previousValue = input.value;
		const previousMin = input.min;
		const previousMax = input.max;
		const previousStep = input.step;
		const previousDefaultValue = input.defaultValue;

		const detail = Object.freeze({
			direction,
			sourceEvent,
			value: oracle.value,
			valueAsNumber: oracle.valueAsNumber,
		}) satisfies NumberFieldChangeDetail;
		const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
		const proposal = new EventConstructor<NumberFieldChangeDetail>("beforechange", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail,
		});
		if (
			!this.dispatchEvent(proposal) ||
			this.#connectionSignal !== connectionSignal ||
			connectionSignal?.aborted ||
			this.ownerDocument !== document ||
			!this.#isCurrentInput(input) ||
			!this.#canStep() ||
			input.value !== previousValue ||
			input.min !== previousMin ||
			input.max !== previousMax ||
			input.step !== previousStep ||
			input.defaultValue !== previousDefaultValue ||
			!this.#currentButton(direction)
		) {
			return false;
		}

		input.value = oracle.value;
		this.#synchronize();
		this.#dispatch("input");
		return (
			this.#connectionSignal === connectionSignal &&
			!connectionSignal?.aborted &&
			this.ownerDocument === document &&
			this.#isCurrentInput(input)
		);
	}

	#dispatch(type: "change" | "input"): void {
		const input = this.#input;
		if (!input) {
			return;
		}
		if (type === "input") {
			const InputEventConstructor = this.ownerDocument.defaultView?.InputEvent ?? InputEvent;
			input.dispatchEvent(new InputEventConstructor(type, { bubbles: true, composed: true }));
		} else {
			const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
			input.dispatchEvent(new EventConstructor(type, { bubbles: true }));
		}
	}

	#stopRepeat(commit: boolean, preserveClick = false): void {
		this.#repeatCleanup?.();
		this.#repeatCleanup = undefined;
		this.#activePointer = undefined;
		if (commit && this.#activeChanged && this.#isActive()) {
			this.#runChange();
		}
		this.#activeChanged = false;
		if (!commit && !preserveClick) {
			this.#clickCleanup?.();
			this.#clickCleanup = undefined;
			this.#suppressClick = undefined;
			return;
		}
		if (!commit) {
			return;
		}
		if (this.#suppressClick) {
			this.#clickCleanup?.();
			const button = this.#suppressClick;
			const window = this.ownerDocument.defaultView;
			const set = window?.setTimeout.bind(window) ?? setTimeout;
			const clear = window?.clearTimeout.bind(window) ?? clearTimeout;
			const timer = set(() => {
				this.#clickCleanup = undefined;
				if (this.#suppressClick === button) {
					this.#suppressClick = undefined;
				}
			}, 0);
			this.#clickCleanup = () => clear(timer);
		}
	}

	#refresh(): void {
		const children = [...this.children];
		const input = children.find(
			(child): child is HTMLInputElement =>
				isDirectInput(this, child) && child.slot === "" && child.type === "number",
		);
		const decrement = children.find(
			(child): child is HTMLButtonElement => isDirectButton(this, child) && child.slot === "decrement",
		);
		const increment = children.find(
			(child): child is HTMLButtonElement => isDirectButton(this, child) && child.slot === "increment",
		);

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
		for (const [previous, next] of [
			[this.#decrementButton, decrement],
			[this.#incrementButton, increment],
		] as const) {
			if (previous && previous !== next) {
				this.#owned.release(previous);
			}
		}
		this.#decrementButton = decrement;
		this.#incrementButton = increment;
		this.#synchronize();
	}

	#currentButton(direction: "decrement" | "increment"): HTMLButtonElement | undefined {
		const button = direction === "decrement" ? this.#decrementButton : this.#incrementButton;
		const current = [...this.children].find(
			(child): child is HTMLButtonElement => isDirectButton(this, child) && child.slot === direction,
		);
		return button && current === button && !button.matches(":disabled") ? button : undefined;
	}

	#isCurrentInput(input: HTMLInputElement): boolean {
		return (
			[...this.children].find(
				(child): child is HTMLInputElement =>
					isDirectInput(this, child) && child.slot === "" && child.type === "number",
			) === input
		);
	}

	#normalizeRecovered(
		property: "disabled" | "max" | "min" | "readOnly" | "required" | "step" | "value" | "valueAsNumber",
		value: unknown,
	): unknown {
		if (property === "disabled" || property === "readOnly" || property === "required") {
			return Boolean(value);
		}
		if (property === "value") {
			return this.#numberString(String(value));
		}
		if (property === "valueAsNumber") {
			return this.#numberValue(value as number).valueAsNumber;
		}
		return String(value);
	}

	#numberString(value: string): string {
		const oracle = this.ownerDocument.createElement("input");
		oracle.type = "number";
		oracle.value = value;
		return oracle.value;
	}

	#numberValue(value: number): HTMLInputElement {
		const oracle = this.ownerDocument.createElement("input");
		oracle.type = "number";
		oracle.valueAsNumber = value;
		return oracle;
	}

	#synchronize(): void {
		const input = this.#input;
		if (!input) {
			this.#setState("disabled", this.disabled);
			this.#setState("readonly", this.readOnly);
			this.#setState("invalid", false);
			return;
		}

		for (const name of ["min", "max", "step"] as const) {
			if (this.hasAttribute(name)) {
				this.#owned.own(input, name, this.getAttribute(name));
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

		const disabled = input.disabled || input.readOnly;
		for (const button of [this.#decrementButton, this.#incrementButton]) {
			if (!button) {
				continue;
			}
			this.#owned.own(button, "type", "button");
			const authorDisabled = this.#owned.author(button, "disabled") !== null;
			this.#owned.own(button, "disabled", disabled || authorDisabled ? "" : null);
		}
		this.#setState("disabled", input.disabled);
		this.#setState("readonly", input.readOnly);
		this.#setState("invalid", !input.validity.valid);
	}

	#setState(state: string, present: boolean): void {
		if (present) {
			this.#internals.states.add(state);
		} else {
			this.#internals.states.delete(state);
		}
	}
}

/** Typed event listeners available on number-field elements. */
export interface NumberFieldElement {
	addEventListener<Type extends keyof NumberFieldEventMap>(
		type: Type,
		listener: (this: NumberFieldElement, event: NumberFieldEventMap[Type]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
}
