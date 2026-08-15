# Design detection and runtime together

- Keep detection syntactic.
  Do not claim runtime name resolution; application code can shadow a built-in-looking identifier.
- Make every injected runtime safe to execute when a syntactic false positive occurs.
- Use self-guarding code that preserves an existing native implementation.
- Keep polyfill IDs stable because they form `virtual:@serve-tools/vite-polyfill/<id>` module names.
- Preserve the supported JS/TS extension and query-string filtering, and continue skipping `node_modules` and virtual modules.
- Expect each matched virtual module to be emitted once per build and allow Rollup to remove it from unrelated chunks.
