# @serve-tools/signal-dom

The `@serve-tools/signal-dom` package provides a surgical templating library for operating on real DOM nodes using a plain functional syntax.

```ts
import { Signal } from "@serve-tools/signal";
import { html, text } from "@serve-tools/signal-dom";

const greeting = new Signal.State("Hello");
const $greeting = html("p", text(greeting));

$greeting(document.body); // appends <p>Hello</p> to the body
greeting.set("Ahoy"); // updates the paragraph to <p>Ahoy</p>
```

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-dom
```

At its core is a simple primitive:

```ts
import { attrs, svg } from "@serve-tools/signal-dom";

// () => <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /></svg>
const $svg = svg("svg",
	attrs({ viewBox: "0 0 16 16" }),
	svg("circle",
		attrs({ cx: 8, cy: 8, r: 6 }),
	),
);
```

- HTML can be made with `html()`.
- MathML can be made with `mathml()`.
- SVG can be made with `svg()`.
- Text can be made with `text()`.
- Shadow roots can be attached with `shadowRoot()`.
- Element internals can be configured with `elementInternals()`.
- Constructed stylesheets can be created with `css` and adopted with `adoptedCSS()`.

Calling the returned function mounts live DOM directly:

```ts
$svg(document.body)
```

## Reactive bindings

Signal DOM uses `@serve-tools/signal` directly:

```ts
import { Signal } from "@serve-tools/signal";
import { attrs, dispose, svg } from "@serve-tools/signal-dom";
```

Static values work normally, while `Signal.State` and `Signal.Computed` values update their bindings automatically.

Removing DOM nodes does not automatically clean up their reactive bindings.
When a reactive subtree is permanently retired, call `dispose(root)` before or after detaching it.
Disposal stops updates owned by the root, its current descendants, and shadow content without removing DOM; repeated calls are safe.

Attributes, properties, and nested fragments all react to signals.

If an attribute is a signal, the DOM updates automatically when it changes:

```ts
const viewBox = new Signal.State("0 0 16 16");

const $svg = svg("svg", attrs({ viewBox }), svg("circle", attrs({ cx: 8, cy: 8, r: 6 })))

// ... later that day ...

viewBox.set("0 0 8 8")
```

A `group()` primitive conditionally presents a persistent group of nodes and handles nested DOM updates cleanly.

Normal false/true toggles intentionally preserve each region's nodes and subscriptions.
Dispose the placeholder, any visible top-level region node, or an ancestor only when that region is permanently retired.

Reactive scheduling is provided by `@serve-tools/signal-effect`; both packages share a compatible `@serve-tools/signal` installation.

## Shadow DOM, styles, and internals

`css` creates a `CSSStyleSheet`; signal interpolations update that same sheet.
`adoptedCSS()` adopts the sheet into a document or shadow root, and `shadowRoot()` attaches a shadow root and applies templates to it.

```ts
import { adoptedCSS, css, html, shadowRoot } from "@serve-tools/signal-dom";

const display = new Signal.State("block");

const $card = html("article",
	shadowRoot({ mode: "open" },
		adoptedCSS(css`:host { display: ${display} }`),
		html("slot"),
	),
)
```

Stylesheets remain plain platform objects.
`dispose(root)` stops reactive sheets adopted with `adoptedCSS()`; call `dispose(sheet)` when a reactive sheet is used independently.

`elementInternals()` calls `attachInternals()` once and assigns writable `ElementInternals` properties.
Its values may also be signals.

```ts
customElements.define("x-control", class extends HTMLElement {});

const role = new Signal.State<string | null>("button");
const control = elementInternals({ role })(document.createElement("x-control"));
```

As with the underlying DOM APIs, a shadow root or element internals can only be attached to a valid host and cannot be attached twice.

The browser suite covers current Playwright releases of Chromium, Firefox, and WebKit.
APIs such as `attachInternals()` and constructed stylesheets still require support from the browser where their corresponding helpers are used.

## Custom elements

Signal DOM templates work directly inside standard custom elements; no package-specific base class is required.

```ts
class GreetingElement extends HTMLElement {
	constructor() {
		super()

		html("p", text("Hello"))(this.attachShadow({ mode: "open" }))
	}
}

customElements.define("greeting-element", GreetingElement)
```

`disconnectedCallback()` can represent a temporary move followed by reconnection.
Call `dispose(this)` there only when the component lifecycle guarantees that instance will never reconnect; disposal is terminal for its existing bindings.

## TypeScript

**Signal DOM** is fully typed for HTML, SVG, and MathML elements, attributes, and properties.

- Typed HTML (`DOM.HTML`)
  - HTML elements can be typed from `DOM.HTML.ElementMap` or `HTMLElementTagNameMap`.
  - HTML attributes are typed from `DOM.HTML.AttributeMap`.
  - HTML properties are typed from `DOM.HTML.PropertyMap`.
- Typed MathML (`DOM.MathML`)
  - MathML elements are typed from `DOM.MathML.ElementMap` or `MathMLElementTagNameMap`.
  - MathML attributes are typed from `DOM.MathML.AttributeMap`.
  - MathML properties are typed from `DOM.MathML.PropertyMap`.
- Typed SVG (`DOM.SVG`)
  - SVG elements are typed from `DOM.SVG.ElementMap` or `SVGElementTagNameMap`.
  - SVG attributes are typed from `DOM.SVG.AttributeMap`.
  - SVG properties are typed from `DOM.SVG.PropertyMap`.

Attributes allow unknown names for ecosystem compatibility, while properties are strictly typed for safety.

```ts
const badButton = html(
	"button",
	attrs({
		// allowable because it's an attribute
		wildidea: "yes",
	}),
	props({
		// @ts-expect-error because "yes" is not a boolean
		disabled: "yes",
	}),
	text("Uh, this is a very strange button"),
)
```

## Public API

- `html()`, `svg()`, and `mathml()` create typed element templates.
- `text()` creates a static or signal-backed text-node template.
- `attrs()` and `props()` assign static or signal-backed attributes and properties.
- `group()` creates a persistent conditional region.
- `shadowRoot()` attaches and populates a shadow root.
- `elementInternals()` attaches internals and assigns writable ARIA properties.
- `css` creates a constructed stylesheet, and `adoptedCSS()` adopts it into a document or shadow root.
- `dispose()` stops bindings owned by a node subtree or constructed stylesheet without removing DOM.
- `CSSValue` describes `css` interpolation values, and the `DOM` namespace exposes element, attribute, and property maps.

## Compatibility

The package is an ES module for browser documents with the standard DOM APIs used by each selected helper.
Constructed stylesheets, `attachInternals()`, shadow DOM, SVG, and MathML still require corresponding browser support.
The package creates real nodes eagerly and does not provide server-side rendering or hydration.

## Agent Skill

This package includes `skills/serve-tools-signal-dom/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs Node.js DOM tests and Playwright tests in Chromium, Firefox, and WebKit.

```shell
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/signal-dom
```

Run the opt-in Chromium benchmarks with:

```shell
npm run benchmark --workspace @serve-tools/signal-dom
```

## License

[MIT-0](./LICENSE.md)
