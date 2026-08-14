import { Signal } from "@serve-tools/signal";
import { LitElement } from "lit";
import type { StyleDeclarations, StyleSource, StyleValue } from "../src/decorators.js";
import { property, style } from "../src/decorators.js";
import { SignalElement } from "../src/lit-signals.js";

declare const cssStyleValue: CSSStyleValue;

class StyledElement extends SignalElement {
	@property()
	accessor size = 20;

	readonly accent = new Signal.State("red");

	@style
	accessor hostStyle = {
		"--accent": this.accent,
		"--size": () => cssStyleValue,
		display: "block",
		opacity: 1,
	};

	@style
	accessor replaceableStyle: style.Declarations = {
		"--accent": this.accent,
	};
}

const declarations = {
	"--accent": new Signal.State("blue"),
	display: () => "grid",
} satisfies StyleDeclarations;

const element = new StyledElement();

element.hostStyle["--accent"] satisfies Signal.State<string>;
element.hostStyle["--size"] satisfies () => CSSStyleValue;
element.hostStyle.display satisfies string;
element.replaceableStyle = { opacity: 0.5 };

const value: StyleValue = cssStyleValue;
const source: StyleSource = () => value;
const namespacedValue: style.Value = value;
const namespacedSource: style.Source = source;

class PlainElement extends LitElement {
	// @ts-expect-error @style hosts require the SignalWatcher lifecycle API.
	@style
	accessor hostStyle = declarations;
}

void declarations;
void namespacedSource;
void namespacedValue;
void source;
void PlainElement;
