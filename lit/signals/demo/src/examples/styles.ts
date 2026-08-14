import { css, html, SignalElement, watch } from "@serve-tools/lit-signals";
import { computed, property, style } from "@serve-tools/lit-signals/decorators";

class SignalColorPicker extends SignalElement {
	static styles = css`
		:host {
			display: grid;
			gap: 1rem;
			padding: 1.25rem;
			border: 1px solid #9b8eca;
			border-radius: 1rem;
			background: #faf8ffde;
		}

		.swatch {
			display: grid;
			min-height: 8rem;
			place-items: center;
			border-radius: 0.75rem;
			color: white;
			background: var(--accent);
			font-weight: 800;
		}

		label {
			display: grid;
			gap: 0.4rem;
			color: #655889;
			font-size: 0.85rem;
			font-weight: 700;
		}

		input {
			width: 100%;
			accent-color: var(--accent);
		}
	`;

	@property()
	accessor hue = 265;

	@computed
	get accent() {
		return `hsl(${this.hue} 62% 52%)`;
	}

	@style
	accessor hostStyle = {
		"--accent": () => this.accent,
	};

	protected render() {
		return html`
			<div class="swatch">${watch(() => this.accent)}</div>
			<label>
				Hue: ${watch(() => this.hue)}°
				<input
					type="range"
					min="0"
					max="360"
					.value=${watch(() => String(this.hue))}
					@input=${(event: InputEvent) => {
						this.hue = (event.currentTarget as HTMLInputElement).valueAsNumber;
					}}
				/>
			</label>
		`;
	}
}

customElements.define("signal-color-picker", SignalColorPicker);
