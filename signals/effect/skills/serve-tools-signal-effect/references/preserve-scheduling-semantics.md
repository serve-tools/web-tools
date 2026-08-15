# Preserve scheduling semantics

- Expect the first run to be synchronous.
- Expect later invalidations to batch onto a microtask.
- Let the effect discover dependencies by reading signals during each run.
- Expect cascading invalidations raised during a flush to schedule a later flush rather than corrupt the current batch.
- Skip disposed effects even if they were pending when the batch began.
- Preserve one thrown error by identity and combine several effect failures in an `AggregateError` after the other pending effects run.
- If the initial run throws, expect the controller to dispose itself before rethrowing.
