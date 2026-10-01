# @serve-tools/polyfill-custom-element-registry

Install missing scoped `CustomElementRegistry` support in Firefox with one capability check and coordinated DOM patches.

```ts
import "@serve-tools/polyfill-custom-element-registry";

const registry = new CustomElementRegistry();
class LocalElement extends HTMLElement {}
registry.define("local-element", LocalElement);
const root = document.createElement("div").attachShadow({
	mode: "open",
	customElementRegistry: registry,
});
root.innerHTML = "<local-element></local-element>";
```

The focused installer is also available:

```ts
import "@serve-tools/polyfill-custom-element-registry/apply/CustomElementRegistry";
```

Both imports run only when the user agent identifies Firefox with a `Firefox/` version token.
Other browsers, including Firefox for iOS (`FxiOS`), are left untouched.
Within Firefox, both imports preserve native support when the scoped-registry capability check succeeds.
The check covers scoped construction, registry association, and the required registry methods.
In a non-DOM environment these imports do nothing.
When support is missing, installation patches the global registry, HTML element constructors, and the related DOM operations as a unit.
Load this package before declaring element classes or capturing DOM methods.

There is no non-mutating constructor-value subpath: the iframe fallback cannot work independently of the coordinated DOM patches.
For an inert import and explicit installation into a selected Window, use `@serve-tools/ponyfill-custom-element-registry`.

The fallback is experimental and inherits the [ponyfill's supported operations and limitations](../../ponyfills/custom-element-registry/#boundaries).
It retains one hidden iframe per registry, has no uninstall API, and cannot reproduce every native realm, parser, or adoption behavior.
Accessible same-origin iframe documents and an HTML document are required.
Scoped customized built-ins are unsupported.
