---
name: serve-tools-vite-polyfills
description: Use @serve-tools/vite-polyfills when configuring, extending, reviewing, or debugging Vite polyfill detection with vitePolyfills, builtinPolyfills, definePolyfill, virtual runtime modules, or ambient types. Covers OXC AST visitors, safe injected code, selection, and false positives; do not use for unrelated runtime-only polyfill imports.
---

# Use @serve-tools/vite-polyfills

## Configure the plugin

- Add `vitePolyfills()` to the Vite plugin list to use all built-ins.
- Pass a filtered `builtinPolyfills` array to select built-ins or an empty array to disable them.
- Use `definePolyfill()` for a custom `id`, runtime `code`, and OXC visitor returned by `detect(found)`.
- Call `found()` only after an AST shape proves that the syntactic feature is present.

## Design detection and runtime together

- Keep detection syntactic.
  Do not claim runtime name resolution; application code can shadow a built-in-looking identifier.
- Make every injected runtime safe to execute when a syntactic false positive occurs.
- Use self-guarding code that preserves an existing native implementation.
- Keep polyfill IDs stable because they form `virtual:@serve-tools/vite-polyfill/<id>` module names.
- Preserve the supported JS/TS extension and query-string filtering, and continue skipping `node_modules` and virtual modules.
- Expect each matched virtual module to be emitted once per build and allow Rollup to remove it from unrelated chunks.

## Keep TypeScript aligned

- Add or update ambient declarations when a polyfill augments a built-in interface not already covered by TypeScript libraries.
- Expose those declarations through the package's `./types` or focused type subpaths.
- Do not add redundant declarations for APIs already supplied by the configured TypeScript libs.

## Validate changes

Test positive detection, comments and strings, computed versus non-computed members, shadowing-safe runtime behavior, custom overrides, empty selections, virtual module loading, ambient types, README examples, build output, and package shape together.
