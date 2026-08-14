export class CodeExampleElement extends HTMLElement {
	readonly #code: HTMLElement;
	readonly #description: HTMLElement;
	readonly #title: HTMLElement;

	constructor() {
		super();

		const root = this.attachShadow({ mode: "open" });

		root.innerHTML = `
			<style>
				:host {
					display: grid;
					grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.85fr);
					gap: 1rem;
					padding-top: 1rem;
					border-top: 1px solid #a99acb;
				}

				.copy,
				.preview {
					min-width: 0;
				}

				.copy {
					display: grid;
					align-content: start;
					gap: 0.75rem;
				}

				.eyebrow,
				h2,
				p {
					margin: 0;
				}

				.eyebrow {
					color: #6840cf;
					font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
					font-size: 0.7rem;
					font-weight: 800;
					letter-spacing: 0.12em;
					text-transform: uppercase;
				}

				h2 {
					font-size: clamp(2rem, 5vw, 3.5rem);
					letter-spacing: -0.055em;
					line-height: 0.95;
				}

				p {
					max-width: 34rem;
					color: #5a4e73;
				}

				.preview {
					align-self: start;
				}

				details {
					grid-column: 1 / -1;
					border: 1px solid #a99acb;
					border-radius: 0.75rem;
					background: #211735;
					color: #f8f4ff;
				}

				summary {
					padding: 0.85rem 1rem;
					font-weight: 750;
					cursor: pointer;
				}

				pre {
					max-height: 32rem;
					margin: 0;
					padding: 1rem;
					border-top: 1px solid #ffffff24;
					overflow: auto;
					font: 0.78rem / 1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
					tab-size: 2;
				}

				@media (max-width: 48rem) {
					:host {
						grid-template-columns: 1fr;
					}

					details {
						grid-column: 1;
					}
				}
			</style>
			<div class="copy">
				<p class="eyebrow">Live example</p>
				<h2></h2>
				<p class="description"></p>
			</div>
			<div class="preview"><slot></slot></div>
			<details>
				<summary>View the TypeScript</summary>
				<pre><code></code></pre>
			</details>
		`;

		this.#code = root.querySelector("code")!;
		this.#description = root.querySelector(".description")!;
		this.#title = root.querySelector("h2")!;
	}

	connectedCallback(): void {
		this.#title.textContent = this.dataset.title ?? "Example";
		this.#description.textContent = this.dataset.description ?? "";
	}

	set source(value: string) {
		this.#code.textContent = value.trim();
	}
}

customElements.define("code-example", CodeExampleElement);
