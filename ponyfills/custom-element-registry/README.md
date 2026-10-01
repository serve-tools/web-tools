# @serve-tools/ponyfill-custom-element-registry

Explicit installation of an experimental iframe-backed scoped `CustomElementRegistry` fallback targeting Firefox.
Based on the supplied registry implementation, with typed exports and isolated browser tests.

## Usage

```ts
import {
	installCustomElementRegistry,
	supportsCustomElementRegistry,
} from "@serve-tools/ponyfill-custom-element-registry";

if (!supportsCustomElementRegistry()) {
	installCustomElementRegistry();
}

const registry = new CustomElementRegistry();
class LocalElement extends HTMLElement {}
registry.define("local-element", LocalElement);
const host = document.createElement("div");
const root = host.attachShadow({ mode: "open", customElementRegistry: registry });
root.innerHTML = "<local-element></local-element>";
```

Importing this package does not modify globals or require a DOM.
`supportsCustomElementRegistry(window?)` checks the coordinated scoped-registry capability and returns false outside a browser.
`installCustomElementRegistry(window?)` explicitly installs the fallback, even on a browser with native scoped support, and returns the installed `CustomElementRegistry` constructor and global `customElements` registry.
Repeated installation into the same Window returns the same installation.
For automatic feature detection and installation in Firefox only, use `@serve-tools/polyfill-custom-element-registry`.
The explicit ponyfill installer does not apply a browser restriction, but forced installation outside Firefox is unsupported.

Unlike a standalone value ponyfill, the fallback needs coordinated patches in the selected Window.
Call the installer before defining custom element classes or capturing native DOM methods.
Element classes must extend that Window's patched `HTMLElement`.
Create scoped elements through `document.createElement(name, { customElementRegistry: registry })` or scoped parsing; direct construction of a scoped-only class has no registry context and throws.
The installer requires an HTML document and accessible same-origin iframe documents.

## Supported operations

The fallback provides registry `define`, `get`, `getName`, `whenDefined`, `upgrade`, and `initialize`, and routes supported DOM operations through registry associations.
These include `createElement`, `createElementNS`, `attachShadow`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `Range.createContextualFragment`, cloning, importing, adopting, and common insertion methods.
The canonical option is `customElementRegistry`; the supplied legacy `attachShadow` aliases `registry` and `customElements` are retained.
Shadow roots also retain the supplied `createElement`, `createElementNS`, and `importNode` convenience methods.

## Boundaries

This is an experimental compatibility implementation, not a standards-complete replacement for native [scoped custom element registries](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements-api).
Each registry retains a hidden iframe for the document lifetime, including the replacement global registry.
There is no uninstall or disposal API.
Construction uses iframe registries, so constructors can initially observe an iframe owner document.
Adoption and prototype normalization do not reproduce every native realm behavior.

Install early and avoid mixing cached pre-install DOM methods or element constructors with the fallback.
On Firefox versions without native `getName`, constructor-name lookups and duplicate-constructor checks cannot recover definitions registered before installation.
Parser APIs not patched by the implementation, including `setHTMLUnsafe`, document streaming, and declarative shadow DOM, are outside its supported surface.
Mutation observation is a recovery mechanism and does not make every browser parser path synchronous.
Insertion patches preflight invalid child references and ancestor cycles, but other invalid `Document` hierarchy shapes can prepare registry state before the native mutation throws.
Scoped registries reject customized built-in definitions.
