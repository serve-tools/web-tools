import type { CheckedChangeDetail, CheckedControlBehavior } from "./_checked-control.js";
import { CheckedControlElement, setCustomState } from "./_checked-control.js";
import { html } from "./template.js";

const behavior = Object.freeze<CheckedControlBehavior>({
	synchronize: (element, internals, checked) => {
		internals.ariaChecked = String(checked);
		setCustomState(internals, "checked", checked);
		internals.setFormValue(
			checked ? element.value : (element.uncheckedValue ?? null),
			checked ? "checked" : "unchecked",
		);
		return false;
	},
});

/** Immutable state proposed by a switch's `beforechange` event. */
export interface SwitchChangeDetail extends CheckedChangeDetail {}

/** Events emitted by a switch element. */
export interface SwitchEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<SwitchChangeDetail>;
}

/** A form-associated switch whose host owns its interaction and accessible semantics. */
export class SwitchElement extends CheckedControlElement {
	declare addEventListener: {
		<Type extends keyof SwitchEventMap>(
			type: Type,
			listener: (this: SwitchElement, event: SwitchEventMap[Type]) => unknown,
			options?: boolean | AddEventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | AddEventListenerOptions,
		): void;
	};

	declare removeEventListener: {
		<Type extends keyof SwitchEventMap>(
			type: Type,
			listener: (this: SwitchElement, event: SwitchEventMap[Type]) => unknown,
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
		super.initializeCheckedControl("switch", "Please turn on this switch.", behavior);
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout() {
		return html`<span part="control" aria-hidden="true"><slot name="thumb"></slot></span><slot></slot>`;
	}
}
