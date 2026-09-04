import { Signal } from "@serve-tools/signal";
import type { TemplateFragment } from "../src/template.js";
import { html, PersistentFragment } from "../src/template.js";

class SignalButton extends HTMLElement {
	disabled = new Signal.State(false);
	label = new Signal.State("Click me (0)");
	clicks = 0;
	#view: TemplateFragment;

	constructor() {
		super();
		const rows = ["A", "B", "C"].map((name) => {
			const element = document.createElement("p");
			const count = new Signal.State(0);
			const view = html(element)`
				<label>Row ${name}: <input aria-label=${`Row ${name}`} .value=${name}></label>
				<button @click=${() => count.set(count.get() + 1)}>Clicks: ${count}</button>
			`;
			element.append(view);
			return { region: new PersistentFragment([element]), count, dispose: view.dispose };
		});
		const order = new Signal.State(rows.map((row) => row.region));
		const visible = new Signal.State(true);
		const contents = new Signal.Computed(() => (visible.get() ? order.get() : []));
		const fragment = html(this)`
			<button .disabled=${this.disabled} @click=${this.handleClick} ${(element: Element) => {
				element.setAttribute("title", "This click handler uses @click and the component as this");
				return () => {
					element.textContent = "Disposed: clicks stopped";
				};
			}}>${this.label}</button>
			<button @click=${() => fragment.dispose()}>Dispose</button>
			<p>Edit the inputs, then move or park the rows. Their nodes and bindings stay alive.</p>
			<button @click=${() => order.set([...order.get()].reverse())}>Reverse rows</button>
			<button @click=${() => {
				rows[0]!.region.hidden = !rows[0]!.region.hidden;
			}}>Hide/show A</button>
			<button @click=${() => visible.set(!visible.get())}>Remove/restore rows</button>
			<button @click=${() => {
				for (const row of rows) {
					row.count.set(row.count.get() + 1);
				}
			}}>Increment all</button>
			<section ${() => () => {
				// This demo owns its row views explicitly; moving them never disposes them.
				for (const row of rows) {
					row.dispose();
				}
			}}>${contents}</section>
		`;
		this.#view = fragment;
		this.attachShadow({ mode: "open" }).append(fragment);
	}

	dispose(): void {
		this.#view.dispose();
	}

	handleClick(): void {
		this.label.set(`Click me (${++this.clicks})`);
	}
}

customElements.define("signal-button", SignalButton);
