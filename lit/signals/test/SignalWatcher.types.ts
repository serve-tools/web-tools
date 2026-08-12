import { LitElement } from "lit";
import { SignalWatcher } from "../src/lit-signals.js";

class BaseElement extends LitElement {
	constructor(readonly label: string) {
		super();
	}
}

class WatchedElement extends SignalWatcher(BaseElement) {}

const element = new WatchedElement("label");

element.label satisfies string;
