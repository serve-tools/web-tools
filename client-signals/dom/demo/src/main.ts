import { Signal } from "@serve-tools/signal";
import { attrs, dispose, group, html, props, text } from "@serve-tools/signal-dom";

const count = new Signal.State(0);
const showDetails = new Signal.State(true);
const doubled = new Signal.Computed(() => count.get() * 2);
const parity = new Signal.Computed(() => (count.get() % 2 === 0 ? "even" : "odd"));

const button = (label: string, onClick: () => void) =>
	html("button", props({ onclick: onClick, type: "button" }), text(label));

const source = `import { Signal } from "@serve-tools/signal";
import { group, html, props, text } from "@serve-tools/signal-dom";

const count = new Signal.State(0);
const showDetails = new Signal.State(true);

html(
	"section",
	html("strong", text(count)),
	html("button", props({ onclick: () => count.set(count.get() + 1) }), text("Increment")),
	group(showDetails, html("aside", text("This region stays alive while hidden."))),
)(document.body);`;

const demo = html(
	"main",
	html("nav", attrs({ "aria-label": "Breadcrumb" }), html("a", attrs({ href: "../../" }), text("← All packages"))),
	html("p", attrs({ class: "eyebrow" }), text("@serve-tools/signal-dom")),
	html("h1", text("Real nodes. Reactive values.")),
	html(
		"p",
		attrs({ class: "intro" }),
		text("These values update through TC39 Signals without a virtual DOM or component render cycle."),
	),
	html(
		"section",
		attrs({ "aria-label": "Signal counter", class: "counter" }),
		html("span", text("Current value")),
		html("strong", text(count)),
		html("p", text(new Signal.Computed(() => `${count.get()} × 2 = ${doubled.get()}, an ${parity.get()} number.`))),
		html(
			"div",
			attrs({ class: "actions" }),
			button("Increment", () => count.set(count.get() + 1)),
			button("Reset", () => count.set(0)),
			button("Toggle details", () => showDetails.set(!showDetails.get())),
		),
		group(
			showDetails,
			html(
				"aside",
				html("strong", text("Persistent conditional region")),
				html("p", text("Toggle this panel off and on. Its nodes and reactive subscriptions are preserved.")),
			),
		),
	),
	html(
		"section",
		attrs({ "aria-label": "Code for the Signal counter", class: "code-example" }),
		html("p", text("Key code")),
		html("pre", html("code", text(source))),
	),
);

demo(document.body);

addEventListener("pagehide", () => dispose(document.body), { once: true });
