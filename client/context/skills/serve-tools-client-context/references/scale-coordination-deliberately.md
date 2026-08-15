# Scale coordination deliberately

- Prefer one shared root per document or one explicitly owned root per isolated boundary.
- Install a root before independent consumers connect when provider-late registration must work across implementations.
- Rely on context-indexed announcement replay rather than DOM-wide mutation observation.
- Destroy explicitly owned roots when their application lifetime ends.
