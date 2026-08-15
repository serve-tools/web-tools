# Choose immediate or dormant startup

- Use `effect(run)` when the effect may run synchronously before its disposer is registered.
  Store and call the returned disposer.
- Use `createEffect(run)` when ownership or cleanup must be registered before the first execution.
  Register `dispose`, then call `start()`.
- Treat disposal before startup as permanent cancellation and repeated `start()` or `dispose()` calls as no-ops.
