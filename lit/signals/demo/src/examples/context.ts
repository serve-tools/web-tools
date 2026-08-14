import { createContext, css, html, SignalElement, watch } from "@serve-tools/lit-signals";
import { consume, provide } from "@serve-tools/lit-signals/decorators";

interface Theme {
	accent: string;
	name: string;
}

const themeContext = createContext<Theme>(Symbol("demo-theme"));
const themes: Theme[] = [
	{ accent: "#6d46d4", name: "Violet" },
	{ accent: "#087e8b", name: "Ocean" },
	{ accent: "#d95d39", name: "Sunset" },
];

class SignalThemeProvider extends SignalElement {
	static styles = css`
		:host {
			display: grid;
			gap: 1rem;
			padding: 1.25rem;
			border: 1px solid #9b8eca;
			border-radius: 1rem;
			background: #faf8ffde;
		}

		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
		}

		button {
			padding: 0.65rem 0.9rem;
			border: 0;
			border-radius: 999px;
			color: white;
			background: #6743c8;
			font: inherit;
			font-weight: 700;
			cursor: pointer;
		}
	`;

	@provide({ context: themeContext })
	accessor theme = themes[0]!;

	protected render() {
		return html`
			<header>
				<span>Providing ${watch(() => this.theme.name)}</span>
				<button @click=${this.#cycleTheme}>Change theme</button>
			</header>
			<slot></slot>
		`;
	}

	readonly #cycleTheme = (): void => {
		const index = (themes.indexOf(this.theme) + 1) % themes.length;

		this.theme = themes[index]!;
	};
}

class SignalThemeConsumer extends SignalElement {
	static styles = css`
		p {
			margin: 0;
			padding: 1rem;
			border-left: 0.4rem solid var(--accent);
			border-radius: 0.5rem;
			background: color-mix(in srgb, var(--accent) 12%, white);
		}
	`;

	@consume({ context: themeContext, subscribe: true })
	accessor theme: Theme = { accent: "#746a87", name: "Fallback" };

	protected render() {
		return html`
			<p style=${watch(() => `--accent: ${this.theme.accent}`)}>
				The consumer received <strong>${watch(() => this.theme.name)}</strong>.
			</p>
		`;
	}
}

customElements.define("signal-theme-provider", SignalThemeProvider);
customElements.define("signal-theme-consumer", SignalThemeConsumer);
