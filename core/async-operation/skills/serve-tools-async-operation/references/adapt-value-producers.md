# Adapt value-producing work

- Convert provider callbacks, async iterables, Observables, or decoded transport frames into immutable typed values.
- Keep wire framing, reconnection, keyed reconciliation, out-of-order joins, persistence, and store routing outside the operation primitive.
- Return the final semantic result from the producer rather than writing it as a terminal value.
- Preserve protocol terminal events as values when consumers need them for replay or persistence, then return or throw the corresponding operation outcome.
- Pass `controller.signal` into the underlying producer and await every `write()` call.
- Do not return from the executor with unsettled writes; the operation rejects that contract violation with `InvalidStateError`.
