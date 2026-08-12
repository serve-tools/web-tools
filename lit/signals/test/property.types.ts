import type { Signal } from "@serve-tools/signal";
import { html, LitElement } from "lit";
import type {
	AttributeConverter,
	PropertyDeclaration,
	SignalPropertyDeclaration,
	TypeHint,
} from "../src/lit-signals.decorators.js";
import { computed, property } from "../src/lit-signals.decorators.js";
import { SignalWatcher, watch } from "../src/lit-signals.js";

class PropertyTypeTestElement extends SignalWatcher(LitElement) {
	@property({ type: Number, reflect: true })
	accessor count = 1;

	@property({
		converter: (value) => (value === null ? 0 : Number(value)),
		useDefault: true,
	})
	accessor convertedCount = 0;

	@property()
	accessor nullableId: string | null = null;

	@computed
	get doubled() {
		return this.count * 2;
	}

	protected override render() {
		return html`${this.count} ${this.doubled}`;
	}
}

const element = new PropertyTypeTestElement();

html`${element.count} ${element.doubled}`;
html`${watch(() => element.count)} ${watch(() => element.doubled)}`;

const converter: AttributeConverter<number, TypeHint> = (value) => Number(value);
const declaration: PropertyDeclaration<number> = { reflect: true };
const signalDeclaration: SignalPropertyDeclaration<number> = { ...declaration, update: "atomic" };
const signal: Signal.Any<number> | undefined = undefined;

void converter;
void signalDeclaration;
void signal;
void PropertyTypeTestElement;
