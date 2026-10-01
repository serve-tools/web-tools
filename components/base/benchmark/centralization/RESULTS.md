# Internals and field centralization — September 15, 2026

The accepted change centralizes internals, custom-state updates, reflected form flags, and attribute ownership.
It reduces combined-consumer executable size while preserving the distinct form-associated, native-input, and field-coordinator contracts.
Lazy internals avoid the bare-element construction regression found in the initial eager implementation.
There is no general runtime-speedup claim.

## Changes and decisions

| Candidate                           | Decision                     | Evidence or boundary                                                                                                                                           |
| ----------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Central eager internals             | Replaced with lazy ownership | Bare construction took 4.569 → 5.139 ms per 10,000 elements, about 12.5% more time.                                                                            |
| Central lazy internals              | Retained                     | One protected read-only cache, no allocation until first access, stable identity across reconnection and adoption.                                             |
| One pure custom-state helper        | Retained                     | Replaces two duplicate helpers and repeated private state setters without adding a method to every Base consumer.                                              |
| Shared reflected-control base       | Retained                     | Shares only `disabled`, `readOnly`, and `required`; the extra prototype layer costs a little in individual entries but removes duplication in mixed consumers. |
| Shared Field attribute ownership    | Retained                     | Deletes the local duplicate; preserves latest author state and skips redundant restoration writes.                                                             |
| Shared validity or field superclass | Not introduced               | FACE validation, nullable native-input delegation, and derived Field presentation state have different contracts.                                              |

Subclasses must migrate their own `attachInternals()` calls to inherited `this.internals` and must not override that accessor.
The custom-element definition must keep internals enabled.
Form association remains opt-in, and native-input wrappers do not become second form owners.

## Size

Both conditions use Rolldown 1.2.7 with production replacement, tree shaking, ESM output, minification, and no comments or source maps.
Registration fixtures retain each selected class; the full-library fixture retains all public barrel exports.
These are fresh matched measurements, not comparisons with the historical Base UI size target.

| Consumer                                 | Baseline raw JS bytes | Final raw JS bytes |          Change |
| ---------------------------------------- | --------------------: | -----------------: | --------------: |
| Base                                     |                18,443 |             18,502 |             +59 |
| Checkbox                                 |                28,020 |             28,068 |             +48 |
| Switch                                   |                25,541 |             25,588 |             +47 |
| Field                                    |                27,336 |             27,413 |             +77 |
| Number Field                             |                27,438 |             27,576 |            +138 |
| OTP Field                                |                23,739 |             23,881 |            +142 |
| Select + Combobox                        |                35,167 |             35,246 |             +79 |
| Field + Number + OTP                     |                39,631 |             39,087 |   −544 (−1.37%) |
| Checkbox + Switch + Field + Number + OTP |                49,445 |             48,492 |   −953 (−1.93%) |
| Full exported library                    |               207,992 |            206,482 | −1,510 (−0.73%) |

Single-entry costs increase by 0.17–0.60%; combined-consumer savings must not be described as universal bundle reductions.
The runtime source falls from 16,211 to 16,030 physical lines, including comments and blanks.
The source module count rises from 56 to 58 because the shared control base and state helper have their own files.
Runtime dependencies and public entrypoints are unchanged.

The matching `npm pack --dry-run --ignore-scripts --json` artifacts fall from 302,065 to 300,887 compressed bytes and from 1,584,257 to 1,572,818 unpacked bytes.
Those package figures include declarations, source maps, README, and license, and are separate from executable JavaScript.
No package was published.

## Runtime

Measurements use Node 24.16.0, Chromium 153.0.8010.12, an Apple M5 Max, and macOS kernel release 25.6.0.
Each suite uses five independent process pairs in alternating baseline/candidate and candidate/baseline order, with no concurrent agent builds, tests, or browser automation.
The practical latency threshold is 5%.
The comparison uses geometric means of process medians and two-sided Student-t intervals over paired log ratios.
Positive ratio changes mean baseline/candidate exceeds one; these are reciprocal speed ratios, not percentages of time removed.

| Workload                          | Baseline batch median, ms | Final batch median, ms | Baseline/final ratio change, 95% interval | Verdict                                      |
| --------------------------------- | ------------------------: | ---------------------: | ----------------------------------------- | -------------------------------------------- |
| Bare construction, 10,000         |                     4.620 |                  4.660 | −3.38% to +1.73%                          | No clear speed change                        |
| Checkbox construction, 10,000     |                    21.760 |                 21.780 | −1.65% to +1.48%                          | No clear speed change                        |
| Number Field construction, 10,000 |                     6.450 |                  5.870 | +8.67% to +11.10%                         | About 9% less time; bounded construction win |
| Field lifecycle, 500              |                    11.720 |                 11.620 | −2.21% to +4.03%                          | No clear speed change                        |
| Menu lifecycle, 500               |                    15.220 |                 15.120 | −0.34% to +1.67%                          | No clear speed change                        |
| Number Field lifecycle, 500       |                    14.820 |                 14.760 | −2.04% to +2.93%                          | No clear speed change                        |
| Toggle lifecycle, 500             |                     5.560 |                  5.540 | −1.50% to +2.26%                          | No clear speed change                        |

All p95 comparisons are inconclusive at the predeclared 5% improvement threshold.
In particular, bare-construction p95 is 9.148 → 9.757 ms with a ratio-change interval of −12.50% to +0.47%; these data do not rule out a tail regression.
The results support the size and ownership simplification, not a universal no-regression claim.

Construction uses ten warmup batches and thirty measured batches, each exceeding twenty observed clock quanta.
The initial 1,000-element construction experiment was precision-limited and is preserved separately; it is not pooled with the 10,000-element runs.
The eager implementation's complete paired results are also retained separately.
Ownership lifecycles use the unchanged existing fixture, five warmup batches, fifteen measured batches, and semantic checks inside each operation.
Construction measurements exclude connection, layout, rendering, and form interaction; lifecycle measurements do not establish manual accessibility readiness.

## Validation and reproduction

The baseline is commit `1c49c1b528a57a19a2f49d11e76958c3a1d1cd60` with a clean worktree before this change.
The final source is the uncommitted centralization change; executable bundle hashes identify the measured candidate.
The [benchmark instructions](README.md) describe the reproducible commands.
Raw builds, source snapshots, package manifests, logs, and paired comparisons are preserved in [the evidence directory](/Users/jonathan/Documents/Codex/outputs/base-centralization-2026-09-15).
The dependency-lock SHA-256 is `0baa309ece9bbd67dee7c45920b7b7f96ee0dd72f5a84b101cb6089f61bfe178`.

Validation includes package typechecking, Chromium/Firefox/WebKit component tests, package-shape checks with publint and Are the Types Wrong, consumer Skill checks, and full repository verification.
The final `npm run verify`, package checks, consumer Skill checks, and formatting checks all pass.
The focused lazy-internals suite passes 1,877 tests with one existing skip across 138 browser files.
Tests cover deferred attachment, access from subclass field initializers, identity through adoption and reconnection, non-FACE form exclusion, reflected flags, native-input ownership, and author-attribute restoration without redundant mutation records.
