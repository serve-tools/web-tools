# Lazy SignalWatcher effect infrastructure benchmark

This benchmark compares production Lit Signals distributions through public `SignalWatcher` imports.
The effect-free mount workload creates, updates, validates, and disconnects 100 watchers per operation.
The one-effect countercase mounts 100 watchers that each register one constructor effect, guarding against shifting setup cost onto effect users.
The dense workload updates 1,000 retained watchers and guards against moving allocation cost into ordinary updates.
All three workloads assert current shadow-DOM text and lifecycle counters inside the timed operation.

Build both distributions before the quiet timing window:

```sh
node lit/signals/benchmark/lazy-effects/build.mjs --label baseline --root /private/tmp/web-tools-reduction-baseline-f4da08e/lit/signals --output /private/tmp/lit-lazy-effects-baseline
node lit/signals/benchmark/lazy-effects/build.mjs --label candidate --root lit/signals --output /private/tmp/lit-lazy-effects-candidate
```

Smoke-check the frozen bundles without collecting timing samples:

```sh
node lit/signals/benchmark/lazy-effects/run.mjs --smoke /private/tmp/lit-lazy-effects-baseline.build.json
node lit/signals/benchmark/lazy-effects/run.mjs --smoke /private/tmp/lit-lazy-effects-candidate.build.json
```

Run at least five independent counterbalanced baseline/candidate pairs for each selected workload in fresh Chromium processes.
Each run uses five warmup samples and fifteen recorded samples.
Do not run builds, tests, other benchmarks, browser automation, or profiling concurrently.

```sh
node lit/signals/benchmark/lazy-effects/run.mjs --confirmed-quiet-slot /private/tmp/lit-lazy-effects-baseline.build.json --workload effect-free-mount
node lit/signals/benchmark/lazy-effects/run.mjs --confirmed-quiet-slot /private/tmp/lit-lazy-effects-candidate.build.json --workload effect-free-mount
```

Repeat the pairs with `one-effect-mount` and `dense-update`.
Omit `--workload` only for a convenient non-isolated run of all three workloads.

Accept only if the full practical interval for the paired effect-free mount improvement exceeds 2%, the one-effect mount and dense-update countercases do not demonstrate regressions, the public entry grows by no more than 100 minified bytes, and lifecycle correctness remains green.

## 2026-09-03 result

The lazy effect-infrastructure candidate was rejected after five isolated, counterbalanced pairs per workload:

- effect-free mount improved 3.40%, with a 95% paired interval of 1.48% to 5.36%; the lower bound missed the primary greater-than-2% gate;
- one-effect mount improved 0.12%, with an interval of -2.38% to 2.68%, which was inconclusive; and
- dense effect-free updates improved 10.59%, with an interval of 5.33% to 16.12%.

The dense-update result is promising but does not justify changing the primary criterion after measurement.
The candidate also added 56 minified bytes to the public package entry and 153 bytes across independently minified distribution modules.
Production was restored to the baseline implementation.
The exact rejected source has SHA-256 `5f202d9d487f2355ccb5fe4344a29ffaf51bf0e6b9ad9fd95f8406b0e6941cdc` and is preserved in the experiment output archive.
