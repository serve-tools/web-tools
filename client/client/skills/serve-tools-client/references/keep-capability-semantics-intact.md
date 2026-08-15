# Keep capability semantics intact

- Treat every namespace and focused subpath as a re-export of its corresponding `@serve-tools/client-*` package.
- Follow the owning package's lifecycle, cancellation, disposal, platform, and compatibility requirements.
- Use Promise-returning operations for finite work and subscriptions only for ongoing occurrences.
- Preserve transient activation around clipboard, picker, sharing, and eyedropper calls.
- Dispose input sessions, database clients, messaging clients, WebSocket clients, storage subscriptions, providers, and consumers according to their owning API.
