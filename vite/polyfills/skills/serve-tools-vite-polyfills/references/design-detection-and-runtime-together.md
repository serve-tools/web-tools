# Design detection and runtime together

- Keep detection syntactic.
  Do not claim runtime name resolution; application code can shadow a built-in-looking identifier.
- Treat the built-in `event-target-when` detector as a conservative member-name match: any non-computed `.when` reference can select it because the AST does not reveal the receiver's runtime type.
- Make every injected runtime safe to execute when a syntactic false positive occurs.
- Use self-guarding code that preserves an existing native implementation.
- Keep the Observable installers granular so `EventTarget.prototype.when` selects the available native or polyfilled `Observable` constructor in partial-native environments.
- Keep polyfill IDs stable because they form `virtual:@serve-tools/vite-polyfill/<id>` module names.
- Preserve the supported JS/TS extension and query-string filtering, and continue skipping `node_modules`, virtual modules, and each injected runtime module's resolved dependency graph.
- Expect each matched virtual module to be emitted once per build and allow Rollup to remove it from unrelated chunks.
