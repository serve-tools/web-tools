# Keep one compatible runtime

Make packages that import Signal directly declare `@serve-tools/signal` so signal-aware libraries share one compatible installation.
When intentionally aliasing another compatible implementation, keep imports pointed at `@serve-tools/signal`.
