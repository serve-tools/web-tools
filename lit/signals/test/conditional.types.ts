import { Signal } from "@serve-tools/signal";
import { SignalArray, SignalObject } from "@serve-tools/signal-collections";
import { html, LitElement } from "lit";
import { collection, property } from "../src/decorators.js";
import {
	type ChooseCase,
	type ChooseDefaultCase,
	choose,
	type WhenFalseCase,
	type WhenTrueCase,
	when,
} from "../src/lit-signals.js";

const enabled = new Signal.State<boolean>(true);
const status = new Signal.State<"idle" | "ready">("idle");

html`${when(
	enabled,
	(value) => {
		value satisfies true;

		return "enabled";
	},
	(value) => {
		value satisfies false;

		return "disabled";
	},
)}`;

html`${choose(status, [
	["idle", () => "Idle"],
	["ready", () => "Ready"],
])}`;

const trueCase: WhenTrueCase<boolean, string> = () => "yes";
const falseCase: WhenFalseCase<boolean, string> = () => "no";
const cases: readonly ChooseCase<"idle" | "ready", string>[] = [["idle", () => "Idle"]];
const defaultCase: ChooseDefaultCase<"idle" | "ready", string> = (value) => value;

html`${when(enabled, trueCase, falseCase)}`;
html`${choose(status, cases, defaultCase)}`;

class ConditionalTypeTestElement extends LitElement {
	@property()
	accessor enabled = false;

	@collection(SignalArray)
	accessor items = [1, 2];

	@collection(SignalObject)
	accessor state = { status: "idle" as "idle" | "ready" };

	protected override render() {
		return html`
			${when(
				() => this.enabled && this.items.length > 0,
				() => this.items.map((item) => html`${item}`),
			)}
			${choose(
				() => this.state.status,
				[
					["idle", () => html`Idle`],
					["ready", () => html`Ready`],
				],
			)}
		`;
	}
}

// @ts-expect-error A plain condition cannot establish a reactive subscription.
when(true, () => "yes");

// @ts-expect-error A plain selection cannot establish a reactive subscription.
choose("idle", [["idle", () => "Idle"]]);

const argumentCallback = (value: boolean) => value;

// @ts-expect-error A reactive source callback receives no arguments.
when(argumentCallback, () => "yes");

void ConditionalTypeTestElement;
