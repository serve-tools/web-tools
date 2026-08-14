import { html, LitElement } from "lit";
import { computed, consume, provide } from "../src/decorators.js";
import { createContext, SignalWatcher, watch } from "../src/lit-signals.js";

interface Theme {
	name: string;
}

const themeContext = createContext<Theme>(Symbol("theme"));

class ThemeProvider extends SignalWatcher(LitElement) {
	@provide({ context: themeContext })
	accessor theme: Theme = { name: "light" };

	@computed
	get themeName() {
		return this.theme.name;
	}

	protected override render() {
		return html`${watch(() => this.themeName)}`;
	}
}

class ThemeConsumer extends SignalWatcher(LitElement) {
	@consume({ context: themeContext, subscribe: true })
	accessor theme: Theme | undefined = undefined;

	@consume({ context: themeContext, update: "lifecycle" })
	accessor fallbackTheme: Theme = { name: "fallback" };

	protected override render() {
		return html`${watch(() => this.theme?.name)} ${this.fallbackTheme.name}`;
	}
}

class InvalidProvider extends LitElement {
	// @ts-expect-error The provided accessor value must match the context value.
	@provide({ context: themeContext })
	accessor theme = "light";
}

class InvalidConsumer extends LitElement {
	// @ts-expect-error The consumed accessor must accept the context value.
	@consume({ context: themeContext })
	accessor theme: string | undefined = undefined;
}

const provider = new ThemeProvider();
const consumer = new ThemeConsumer();

provider.theme = { name: "dark" };

html`${provider.theme.name} ${consumer.theme?.name}`;

void InvalidProvider;
void InvalidConsumer;
