import { Signal } from "@serve-tools/signal";
import { SignalArray } from "@serve-tools/signal-collections";
import { html, LitElement } from "lit";
import { collection } from "../src/decorators.js";
import { repeat } from "../src/lit-signals.js";

const values = new Signal.State<readonly string[]>(["value"]);

repeat(values, (value, index) => html`${index}:${value}`);
repeat(
	values,
	(value) => value,
	(value, index) => html`${index}:${value}`,
);

class CollectionModel extends LitElement {
	@collection(SignalArray)
	accessor values = ["value"];

	template() {
		return repeat(
			() => this.values,
			(value) => value,
			(value) => html`${value}`,
		);
	}
}

void CollectionModel;

// @ts-expect-error plain iterables are read before the reactive boundary.
repeat(["value"], (value) => value);

const argumentCallback = (argument: string) => [argument];

// @ts-expect-error callback sources must not require arguments.
repeat(argumentCallback, (value) => value);
