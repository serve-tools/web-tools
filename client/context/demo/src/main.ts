/// <reference lib="dom" />

import { ContextConsumer, ContextProvider, createContext } from "@serve-tools/client-context";

interface Theme {
	accent: string;
	name: string;
}

const themeContext = createContext<Theme>(Symbol("demo-theme"));

class ThemeProviderElement extends HTMLElement {
	readonly #provider = new ContextProvider(this, {
		context: themeContext,
		initialValue: this.#readTheme(),
	});

	connectedCallback(): void {
		this.#provider.connect();
	}

	disconnectedCallback(): void {
		this.#provider.disconnect();
	}

	setTheme(theme: Theme): void {
		this.dataset.name = theme.name;
		this.dataset.accent = theme.accent;
		this.style.setProperty("--accent", theme.accent);
		this.querySelector("h2")!.textContent = theme.name;
		this.#provider.setValue(theme);
	}

	#readTheme(): Theme {
		return {
			accent: this.dataset.accent ?? "#087e8b",
			name: this.dataset.name ?? "Theme",
		};
	}
}

class ThemeConsumerElement extends HTMLElement {
	readonly #consumer = new ContextConsumer(this, {
		context: themeContext,
		subscribe: true,
		callback: (theme) => this.#render(theme),
	});

	connectedCallback(): void {
		this.#consumer.connect();
	}

	disconnectedCallback(): void {
		this.#consumer.disconnect();
	}

	connectedMoveCallback(): void {
		this.#consumer.refresh();
	}

	#render(theme: Theme): void {
		this.style.setProperty("--accent", theme.accent);
		this.replaceChildren(
			Object.assign(document.createElement("span"), { className: "consumer-label", textContent: "Consumer" }),
			Object.assign(document.createElement("strong"), { textContent: theme.name }),
			Object.assign(document.createElement("span"), { textContent: theme.accent }),
		);
	}
}

customElements.define("demo-theme-provider", ThemeProviderElement);
customElements.define("demo-theme-consumer", ThemeConsumerElement);

const consumer = document.querySelector<ThemeConsumerElement>("demo-theme-consumer")!;
const palettes: Record<string, Theme[]> = {
	"ocean-provider": [
		{ accent: "#087e8b", name: "Ocean" },
		{ accent: "#2667ff", name: "Tide" },
	],
	"sunset-provider": [
		{ accent: "#d95d39", name: "Sunset" },
		{ accent: "#9c27b0", name: "Twilight" },
	],
};

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-move]")) {
	button.addEventListener("click", () => {
		const provider = document.querySelector<ThemeProviderElement>(`#${button.dataset.move}`)!;

		provider.querySelector(".consumer-slot")!.append(consumer);
	});
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-cycle]")) {
	let index = 0;

	button.addEventListener("click", () => {
		const id = button.dataset.cycle!;
		const provider = document.querySelector<ThemeProviderElement>(`#${id}`)!;
		const themes = palettes[id]!;

		index = (index + 1) % themes.length;
		provider.setTheme(themes[index]!);
	});
}
