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

### Reconnectable binding scopes

Use `createBindingScope()` when a persistent DOM tree must release its signal subscriptions while disconnected and reconcile them when it reconnects.
Unscoped templates keep their immediate, terminal lifecycle described above.

```ts
import { Signal } from "@serve-tools/signal";
import { attrs, createBindingScope, html, text } from "@serve-tools/signal-dom";

const scope = createBindingScope();
const label = new Signal.State("Ready");
const content = document.createDocumentFragment();
const button = scope.capture(() => html("button", attrs({ title: label }), text(label))(content));

document.body.append(content);

if (!scope.resume()) {
	// The caller decides whether and when to retry an activation interrupted by reentrant lifecycle work.
}

scope.suspend();
label.set("Current while disconnected");
scope.resume(); // synchronously writes the current value into the same button and text node
```

`capture()` applies each signal's current value once without retaining a subscription, so detached construction has predictable initial DOM.
The callback and every template call that it starts must complete synchronously; returning a Promise or another thenable throws and retires the bindings created by that capture.
The type signature rejects `PromiseLike` results, but the runtime guard remains for untyped callers.
Rollback covers work captured before the callback returns; it cannot cancel user code that an async function already scheduled after an `await`.
Ordinary nested synchronous capture remains supported, but the same scope rejects capture while one of its binding setters or a resume attempt is running.

`resume()` creates fresh effects for the retained binding records and synchronously reconciles every current value, even when it equals the value applied during capture.
It updates retained binding targets; it does not reconstruct nodes removed or relocated inside a binding-owned region.
It returns `true` after a complete activation or when the scope is already active.
It returns `false` without scheduling work when the scope is disposed, capture or a binding setter is running, another resume is in progress, or synchronous suspension invalidates the activation.

`suspend()` synchronously stops active effects and suppresses their already queued writes while preserving nodes, locally held state, and restart factories.
Repeated suspension is safe.
`dispose()` is terminal and idempotent; it retires every record so later resume calls return `false`.
Calling the existing `dispose(node)` also retires captured records owned by that node, so a later scope resume cannot revive them.

Capture follows construction rather than the current DOM tree.
Bindings created for closed shadow content and hidden `group()` nodes remain in the scope, while nodes that were not constructed inside the capture, such as caller-owned slotted content, are not added by traversal.
Groups retain their existing visibility semantics: hiding a group does not suspend its bindings while the containing scope remains active.

Templates created with a supplied target use that target's `ownerDocument`, including nested HTML, SVG, MathML, text, and group content.
Construct shared stylesheets in the document that will adopt them.
Scoped reactive stylesheets should remain instance-owned; adopting one sheet into several roots retains the existing `adoptedCSS()` ownership semantics.

## Tagged templates

The opt-in `@serve-tools/signal-dom/template` subpath provides a shared minimal Lit-style renderer without changing the main entrypoint's functional `html(tagName, ...)` API.
It exports persistent `html(owner, ownerDocument?)`, managed `scopedHtml(owner, ownerDocument?)`, `TemplateFragment`, `TemplateDirective`, and `PersistentFragment`.

```ts
import { Signal } from "@serve-tools/signal";
import { createBindingScope } from "@serve-tools/signal-dom";
import { scopedHtml } from "@serve-tools/signal-dom/template";

const owner = {};
const label = new Signal.State("Ready");
const scope = createBindingScope();
const view = scope.capture(() => scopedHtml(owner)`<button type="button">${label}</button>`);
document.body.append(view);
scope.resume();
scope.suspend(); // Retain DOM, listeners, and directives; stop reactive observation.
label.set("Current");
scope.resume(); // Reconcile synchronously, even if the value did not change.
scope.dispose(); // Retire bindings, listeners, and directive cleanups; retain DOM.
```

`scopedHtml` must be invoked as a tag inside synchronous binding capture; otherwise it throws before setup.
The returned fragment's `dispose()` also retires that view independently, and capture rollback cleans up complete managed views if later construction fails.
Listeners and directives run once per view, not once per connection; consumed `once` listeners are not rearmed by resume.
Directives are not connection-resource factories: external listeners, timers, and observers still need explicit connection ownership.

Use standalone `html(owner)` when observation must persist during removal, hiding, and movement.
It deliberately ignores ambient capture, so retain the returned handle and call `view.dispose()` when permanently retiring it.
Weak owner scheduling does not prevent an externally retained signal or handle from retaining its view.

Both tags support child values, whole attributes, `.property`, `@event`, and synchronous opening-tag directives.
Only `null` removes an attribute; use `.disabled=${boolean}` for native boolean properties.
Mixed attribute strings, raw-text/comment interpolations, dynamic tag names, and nested template-content holes are rejected before setup; source boundary whitespace is trimmed.
Dynamic child strings are text, but this is not an HTML sanitizer and sensitive property sinks retain their native security requirements.
The owner supplies the document when available; an explicit second document argument overrides it.
DOM writers retain the existing dependency-tracking behavior, including signal reads inside property setters.
Read [Own tagged templates](skills/serve-tools-signal-dom/references/own-tagged-templates.md) for events, cleanup, and reusable-region boundaries.

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
- `createBindingScope()` captures reconnectable bindings with explicit resume, suspension, and terminal disposal.
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
