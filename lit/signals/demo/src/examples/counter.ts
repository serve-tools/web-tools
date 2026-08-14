import { css, html, Signal, SignalElement, when } from "@serve-tools/lit-signals";

class SignalCounter extends SignalElement {
	static styles = css`
		:host {
			display: grid;
			gap: 1rem;
			padding: 1.5rem;
			border: 1px solid #9b8eca;
			border-radius: 1rem;
			background: #faf8ffde;
			box-shadow: 0 1rem 3rem #412e7720;
		}

		.header,
		.actions {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: space-between;
			gap: 0.75rem;
		}

		.label {
			color: #655889;
			font-size: 0.72rem;
			font-weight: 800;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.value {
			font-size: clamp(4rem, 12vw, 7rem);
			font-weight: 760;
			letter-spacing: -0.08em;
			line-height: 0.8;
		}

		meter {
			width: 100%;
			accent-color: #6d46d4;
		}

		button {
			padding: 0.65rem 0.9rem;
			border: 1px solid #6743c8;
			border-radius: 999px;
			color: white;
			background: #6743c8;
			font: inherit;
			font-weight: 700;
			cursor: pointer;
		}

		button:last-child {
			color: #5737b0;
			background: transparent;
		}

		.status {
			margin: 0;
			color: #54496f;
		}
	`;

	readonly #count = new Signal.State(0);
	readonly #meter = new Signal.Computed(() => this.#count.get() % 11);
	#renders = 0;

	protected render() {
		++this.#renders;

		return html`
			<div class="header">
				<span class="label">Current value</span>
				<span class="label">Lit renders: ${this.#renders}</span>
			</div>
			<strong class="value">${this.#count}</strong>
			<meter min="0" max="10" .value=${this.#meter}></meter>
			${when(
				() => this.#count.get() === 0,
				() => html`<p class="status">Start the counter. Each Signal updates only its own template part.</p>`,
				() => html`<p class="status">The current count is ${this.#count.get() % 2 === 0 ? "even" : "odd"}.</p>`,
			)}
			<div class="actions">
				<button @click=${() => this.#count.set(this.#count.get() + 1)}>Increment</button>
				<button @click=${() => this.#count.set(0)}>Reset</button>
			</div>
		`;
	}
}

customElements.define("signal-counter", SignalCounter);
