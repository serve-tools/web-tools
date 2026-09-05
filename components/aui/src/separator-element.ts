import { upgradeProperty } from "./.upgrade.js";
import { AUIElement } from "./aui-element.js";
import { html } from "./template.js";

/** The separator's visual and semantic axis. */
export type SeparatorOrientation = "horizontal" | "vertical";

/** A passive separator with host-owned semantics and a presentational native rule. */
export class SeparatorElement extends AUIElement {
	static readonly observedAttributes = ["decorative", "orientation"];

	#internals = this.attachInternals();
	#separator = this.ownerDocument.createElement("hr");

	constructor() {
		super();

		this.#separator.setAttribute("aria-hidden", "true");
		this.#separator.setAttribute("part", "separator");
		for (const property of ["decorative", "orientation"] as const) {
			upgradeProperty(this, property);
		}
		this.#synchronize();
	}

	/** The axis used by the separator. Invalid attributes read as horizontal. */
	get orientation(): SeparatorOrientation {
		return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";
	}

	set orientation(value: SeparatorOrientation) {
		this.setAttribute("orientation", value === "vertical" ? "vertical" : "horizontal");
	}

	/** Whether the component supplies presentational default semantics through ElementInternals. */
	get decorative(): boolean {
		return this.hasAttribute("decorative");
	}

	set decorative(value: boolean) {
		this.toggleAttribute("decorative", Boolean(value));
	}

	/** The presentational native rule available for styling through `::part(separator)`. */
	get separator(): HTMLHRElement {
		return this.#separator;
	}

	attributeChangedCallback(): void {
		this.#synchronize();
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout() {
		return html`${this.#separator}`;
	}

	#synchronize(): void {
		const orientation = this.orientation;
		this.#internals.role = this.decorative ? "none" : "separator";
		this.#internals.ariaOrientation = this.decorative ? null : orientation;

		this.#setState("decorative", this.decorative);
		this.#setState("horizontal", orientation === "horizontal");
		this.#setState("vertical", orientation === "vertical");
	}

	#setState(state: string, present: boolean): void {
		if (present) {
			this.#internals.states.add(state);
		} else {
			this.#internals.states.delete(state);
		}
	}
}
