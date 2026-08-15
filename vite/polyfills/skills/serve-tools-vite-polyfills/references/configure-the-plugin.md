# Configure the plugin

- Add `vitePolyfills()` to the Vite plugin list to use all built-ins.
- Pass definitions through the `polyfills` option: `vitePolyfills({ polyfills: [...builtinPolyfills, custom] })`.
- Filter `builtinPolyfills` before assigning it to `polyfills` to select built-ins, or pass `polyfills: []` to disable them.
- `builtinPolyfills` is an exported array, not an option name.
- Use `definePolyfill()` for a custom `id`, runtime `code`, and OXC visitor returned by `detect(found)`.
- Call `found()` only after an AST shape proves that the syntactic feature is present.
