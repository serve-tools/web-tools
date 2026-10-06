# Polyfills

Packages that install missing platform features into the global environment.
Each polyfill preserves an existing native implementation.

Each immediate subdirectory is an independently versioned npm workspace.

## Choose how to use a missing platform feature

| Your requirement                                                       | Choose                                        |
| ---------------------------------------------------------------------- | --------------------------------------------- |
| Existing code expects a global or prototype method                     | A polyfill root or selective `apply/*` import |
| Library code must not change globals, but should prefer native support | The polyfill's documented value subpath       |
| You need the package implementation regardless of native support       | The [matching ponyfill](../ponyfills/)        |

For example, `polyfill-urlpattern` installs a missing `URLPattern`, `polyfill-urlpattern/URLPattern` exports the native constructor or fallback without installation, and `ponyfill-urlpattern` always exports the fallback.
Scoped custom-element registries are an exception: their fallback requires coordinated DOM patches and has no standalone constructor-value import.
ArrayBuffer base64 currently exports only a Node.js runtime.
Choose experimental Observable, Composites, and scoped-registry fallbacks only after reviewing their package-specific boundaries.

## Packages

- [`@serve-tools/polyfill-decorator-metadata`](./decorator-metadata/) installs the missing `Symbol.metadata` key.
- [`@serve-tools/polyfill-prioritized-task-scheduling`](./prioritized-task-scheduling/) preserves native scheduling or installs the fallback.
- [`@serve-tools/polyfill-arraybuffer-base64`](./arraybuffer-base64/) installs `Uint8Array.prototype.toBase64()` in Node.js.
- [`@serve-tools/polyfill-composites`](./composites/) installs a missing `Composite` global with the experimental ponyfill's documented identity limits.
- [`@serve-tools/polyfill-custom-element-registry`](./custom-element-registry/) installs missing scoped-registry support in Firefox through coordinated DOM patches.
- [`@serve-tools/polyfill-observable`](./observable/) installs missing `Observable`, `Subscriber`, and `EventTarget.prototype.when` APIs with the ponyfill's documented cold-execution fallback.
- [`@serve-tools/polyfill-request-idle-callback`](./request-idle-callback/) installs the `requestIdleCallback` and `cancelIdleCallback` globals.
- [`@serve-tools/polyfill-report-error`](./report-error/) installs a missing `reportError()` global while preserving a native implementation.
- [`@serve-tools/polyfill-resource-management`](./resource-management/) installs ECMAScript Explicit Resource Management globals.
- [`@serve-tools/polyfill-urlpattern`](./urlpattern/) installs `URLPattern` while preserving a native implementation.
