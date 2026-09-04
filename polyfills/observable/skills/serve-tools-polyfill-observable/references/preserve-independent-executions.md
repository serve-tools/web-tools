# Preserve independent executions

The fallback Observable is cold: every `subscribe()` call and Promise-returning terminal operation starts a distinct execution.
Keep producer resources, operator state, AbortSignals, and teardown callbacks local to that execution.

The installed `EventTarget.prototype.when()` fallback creates one event listener per execution and removes it when that execution completes, errors, or is cancelled.
When a native Observable or native EventTarget method is selected, its semantics can differ as the platform proposal evolves.
Do not rely on fallback-specific ordering without explicitly importing `@serve-tools/ponyfill-observable`.
