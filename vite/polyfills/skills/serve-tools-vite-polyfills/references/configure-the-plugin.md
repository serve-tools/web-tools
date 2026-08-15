# Configure the plugin

- Add `vitePolyfills()` to the Vite plugin list to use all built-ins.
- Pass a filtered `builtinPolyfills` array to select built-ins or an empty array to disable them.
- Use `definePolyfill()` for a custom `id`, runtime `code`, and OXC visitor returned by `detect(found)`.
- Call `found()` only after an AST shape proves that the syntactic feature is present.
