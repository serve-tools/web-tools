# Configure the plugin

- Add `vitePolyfills()` to the Vite plugin list to use all built-ins.
- The built-ins include `Observable`, `Subscriber`, `EventTarget.prototype.when`, `Composite`, `CustomElementRegistry`, URLPattern, scheduling, idle callbacks, resource management, decorator metadata, and Map upsert.
- Pass definitions through the `polyfills` option: `vitePolyfills({ polyfills: [...builtinPolyfills, custom] })`.
- Filter `builtinPolyfills` before assigning it to `polyfills` to select built-ins, or pass `polyfills: []` to disable them.
- `builtinPolyfills` is an exported array, not an option name.
- Use `definePolyfill()` for a custom `id`, runtime `code`, and OXC visitor returned by `detect(found)`.
- Call `found()` only after an AST shape proves that the syntactic feature is present.
- Filter out `event-target-when` when an application uses unrelated `.when` members and does not need the `EventTarget` proposal method: `vitePolyfills({ polyfills: builtinPolyfills.filter(({ id }) => id !== "event-target-when") })`.
- The `custom-element-registry` built-in detects `CustomElementRegistry` identifiers and loads `@serve-tools/polyfill-custom-element-registry/apply/CustomElementRegistry`.
- Automatic installation runs only when the browser user agent contains a `Firefox/<version>` token and native scoped registries fail the capability check.
- Other browsers remain unchanged; use the ponyfill package's explicit installer for deliberate installation in another supported browser realm.
- Its experimental fallback patches the registry, HTML constructors, and DOM methods as one installation and requires a live document with same-origin iframe access.
- Filter out `custom-element-registry` when those coordinated patches should be installed explicitly instead.
