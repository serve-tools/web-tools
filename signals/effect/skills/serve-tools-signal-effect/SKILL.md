---
name: serve-tools-signal-effect
description: Use @serve-tools/signal-effect when implementing, reviewing, or debugging microtask-batched reactive effects over @serve-tools/signal, including effect, createEffect, start, disposal, batching, and failure behavior. Do not use for Effect-TS computations, generic side effects, or unrelated framework effect APIs.
---

# Use @serve-tools/signal-effect

## Choose immediate or dormant startup

- Use `effect(run)` when the effect may run synchronously before its disposer is registered.
  Store and call the returned disposer.
- Use `createEffect(run)` when ownership or cleanup must be registered before the first execution.
  Register `dispose`, then call `start()`.
- Treat disposal before startup as permanent cancellation and repeated `start()` or `dispose()` calls as no-ops.

## Preserve scheduling semantics

- Expect the first run to be synchronous.
- Expect later invalidations to batch onto a microtask.
- Let the effect discover dependencies by reading signals during each run.
- Expect cascading invalidations raised during a flush to schedule a later flush rather than corrupt the current batch.
- Skip disposed effects even if they were pending when the batch began.
- Preserve one thrown error by identity and combine several effect failures in an `AggregateError` after the other pending effects run.
- If the initial run throws, expect the controller to dispose itself before rethrowing.

## Avoid synchronization effects

Prefer Computed signals for derived values.
Introduce an effect for observation or interaction with an external system, not merely to copy one signal into another.

## Validate changes

Update scheduling behavior, public types, README, Node tests, browser tests, type fixtures, and package shape together.
Cover initial failure, batched writes, cascading invalidation, multiple failures, disposal while pending, and dormant startup.
