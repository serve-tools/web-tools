# Base Checkbox repeated-mount diagnostic

This diagnostic tests whether repeatedly running a sink derived from the historical full semantic and DOM-accounting sink changes the latency of the next mount through browser history such as allocation pressure.
It does not compare Base with Base UI, establish release readiness, or replace the frozen August 28 comparison.

The fixture bundles the public `@serve-tools/base-components/checkbox` implementation from the current production build.
Each timed mount constructs and configures 1,000 labeled Checkboxes in a detached form, connects the complete form once, and awaits one completion microtask.
Teardown and semantic validation remain outside the mount clock and are recorded separately.

Two conditions run in fresh Chromium processes in five counterbalanced pairs:

- `validate-each` runs the derived full sink after every warmup and recorded mount.
- `validate-final` runs the same full sink after the final warmup and final recorded mount only.

Both conditions use two warmups and twelve recorded mounts.
Every full sink checks control identity, state, labels, form ownership, exact `FormData`, light-DOM count, shadow-root count, and shadow-element count.
The final sink must be identical in both conditions.
No forced garbage collection, profiler, browser reuse between conditions, or latency outlier exclusion is allowed.

The primary diagnostic metric is the paired geometric ratio of the within-process mount medians, `validate-each / validate-final`.
An entire two-sided 95% Student-t interval above `1.10` identifies at least 10% sensitivity to validation history in this fixture.
An interval entirely below `1 / 1.10` identifies a material loss from deferring validation.
Anything else is inconclusive.
This contrast does not by itself attribute an effect to garbage collection or prove that the historical harness caused its result.
The fixture omits the historical comparison's CSS and uses two warmups and twelve observations, so this threshold diagnoses the current harness only; it is not the package's 5% release-performance gate.

Run only in a quiet measurement window, without concurrent builds, tests, benchmarks, browser automation, or profiling:

```sh
npm run build --workspace @serve-tools/base-components
node components/base/benchmark/build.mjs
node components/base/benchmark/run.mjs --confirmed-quiet-slot /private/tmp/base-mount-diagnostic.json
node components/base/benchmark/analyze.mjs /private/tmp/base-mount-diagnostic.json
```

The browser is loaded through an intercepted synthetic HTTPS origin, so no loopback server is required.
The raw JSON records the revision, dirty Base paths, runtime, browser, hardware, bundle hash, condition order, every mount and teardown duration, and every validation duration.
