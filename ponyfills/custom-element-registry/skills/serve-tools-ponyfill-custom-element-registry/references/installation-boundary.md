# Installation boundary

Import the ponyfill installer to choose when and which Window to patch.
Import the polyfill root or `apply/CustomElementRegistry` before defining element classes to install only in Firefox when the capability check fails.
Automatic installation requires a `Firefox/` user-agent token; Chromium, WebKit, and Firefox for iOS are left untouched.
There is no independent constructor-only fallback: element constructors, DOM creation, parsing, insertion, cloning, and registry association must agree.
The ponyfill import is inert, but calling its installer mutates the selected Window even when native scoped registries exist.
The fallback targets Firefox; forced installation in other engines is unsupported.

The iframe fallback requires an HTML document and access to same-origin iframe documents.
Each registry retains a hidden iframe for the lifetime of the document; there is no uninstall or disposal API.
Use the selected Window's patched `HTMLElement` when defining classes after installation.
Constructors may initially observe an iframe owner document, and internal adoption/prototype normalization cannot reproduce every native realm behavior.
Do not rely on unpatched parser APIs such as `setHTMLUnsafe`, streaming parsing, declarative shadow DOM, or constructors captured before installation.
Insertion patches preflight invalid child references and ancestor cycles, but other invalid `Document` hierarchy shapes can prepare registry state before the native mutation throws.
Scoped customized built-ins are unsupported.
