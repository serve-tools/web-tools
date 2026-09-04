# Release plan — September 4, 2026

The user authorized publication after all work is committed, pushed, and CI passes.
AUI remains private and is not part of this release.
The September 4 registry and shipped-file audit found the thirteen prepared versions below unpublished and identified one required patch for Rolldown Decorators.

The later AUI template migration is separate from that publication authorization.
The user has authorized committing and pushing the migration for CI.
Its AUI `0.1.0`, Signal DOM `0.3.0`, and Client Signals `0.3.1` candidates remain held for package publication, which requires separate authorization.

## Approved release batch

Publish these thirteen versions with the `latest` tag through the provenance-enabled release workflow, subject to the first-release provenance blocker below.
The table follows the release planner's dependency order.

| Package                            | Version | Change                                                                                                            |
| ---------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `@serve-tools/client-dom-fragment` | `0.1.0` | First release of reusable DOM regions, including hidden-region ancestry and exact region lookup.                  |
| `@serve-tools/signal-db`           | `0.2.2` | Retained-query/editor-draft consumer guidance and recipe.                                                         |
| `@serve-tools/signal-dom`          | `0.2.0` | Reconnectable binding scopes and the opt-in `/template` renderer with persistent `html` and managed `scopedHtml`. |
| `@serve-tools/signal-shared-db`    | `0.3.2` | Matching retained-query/editor-draft guidance for shared-worker updates.                                          |
| `@serve-tools/client-signals`      | `0.3.0` | Umbrella release selecting Signal DOM `^0.2.0`.                                                                   |
| `@serve-tools/client-webtransport` | `0.1.3` | Legacy shared-datagram writable compatibility while preserving independent-queue capability checks.               |
| `@serve-tools/ponyfill-composites` | `0.0.1` | First release with documented module-local structural identity and native-proposal limitations.                   |
| `@serve-tools/polyfill-composites` | `0.0.1` | Native-preserving Composite installer and mutation-free native-aware export.                                      |
| `@serve-tools/ponyfill-observable` | `0.0.1` | First release with independent cold executions, explicit imports, and documented proposal differences.            |
| `@serve-tools/polyfill-observable` | `0.0.1` | Native-preserving Observable, Subscriber, and EventTarget.when installers and selective exports.                  |
| `@serve-tools/rolldown-decorators` | `0.1.3` | Include the required runtime helper in built packages; reduce transform traversal and runtime sorting overhead.   |
| `@serve-tools/skills`              | `0.0.6` | Package selection and availability guidance, including the new packages and private AUI boundary.                 |
| `@serve-tools/vite-polyfills`      | `0.3.0` | Detect the new polyfills, expose their types, prevent recursive injection, and consolidate built-in definitions.  |

DOM Fragment must precede Signal DOM, which must precede Client Signals.
The Observable and Composites ponyfills must precede their polyfills, which must precede Vite Polyfills.
The release planner validates internal dependency ranges and orders the batch.
Compatible patch ranges do not require dependency-wide version rewrites.

The database patch releases change shipped guidance, not runtime or declarations.
Rolldown Decorators `0.1.2` is already published and cannot be overwritten; its tarball lacks the helper that its plugin loads, so the corrected packaging and measured optimizations require `0.1.3`.
Changes to Client Router, HTTP Contract, and Lit Signals are test/benchmark-only; Async Operation and Router have development-dependency-only metadata changes, and Resource Management has a blank-line-only source change.
Those packages do not need new releases.

## Existing release holds

| Package or work                     | Reason                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@serve-tools/aui@0.1.0`            | The corrected Checkbox latency and retention gates pass, but the [accepted plan](components/aui/design/plan.md#release-holds) still requires resolving the bundle-size shortfall and completing manual acceptance. The [template migration review](components/aui/design/template-migration.md) records the new production API and validation evidence. |
| Agent benchmark reports and harness | Repository research/tooling, not a package release. Preserve frozen results; they do not justify replacing the published Skills wholesale.                                                                                                                                                                                                              |

An AUI preview is a separate decision requiring explicit narrower preview criteria, not an implicit waiver of the existing release gates.
The independent `DisposableElement` remains internal; publishing the template entrypoint does not make it a supported component base.
Observable and Composites are not held for renaming or a preview-tag decision: the requested first releases retain their current names and intentional contracts.
Their initial versions do not promise exact native-proposal fidelity.

## AUI work before release

The [repeated-mount diagnostic](components/aui/benchmark/RESULTS.md) found that full validation after every sample perturbed later mount measurements: the paired mount-median ratio was 3.931, with a 95% interval of 3.067–5.037.
This AUI-only result is not a production speedup or a new Base UI comparison, and it does not close the mount-performance gate.
The separately frozen, symmetric [current Checkbox comparison](components/aui/design/performance.md#current-checkbox-comparison-september-4-2026) now separates repeated validation effects while preserving semantic checks and passes all five workload median and p95 bounds.
The distinct template experiment estimates 42% less mounting time and 59% less reconnection time than its own frozen baseline; neither comparison establishes whole-library superiority.
The September 4 production migration changes every constructed AUI layout to return an inert `html` description.
The base materializes that result inside its binding scope with the element as its event-handler context.
Standalone callers use `createFragment(result, owner)`; deprecated `html(owner)` and `scopedHtml(owner)` preserve existing ownership behavior.
Failed layout construction rolls back managed resources, while ordinary disconnect only suspends observation.
Connection resources use lazy `DisposableStack` and AbortController allocation; environments without `DisposableStack` need the documented explicit polyfill.
Native checkedness, validity, form values, and event ordering remain synchronous.
Signal DOM `0.2.0` is already published, so this follow-up prepares `0.3.0` and Client Signals `0.3.1`, outside the historical batch above.
See the [migration review](components/aui/design/template-migration.md) for final checks, source-locked measurements, and approval requirements.

The [accessibility acceptance checklist](components/aui/design/accessibility.md) covers Chrome, Firefox, and Safari.
It requires manual NVDA checks with Chrome and Firefox, and VoiceOver with Safari, with supplemental VoiceOver checks in Chrome and Firefox.
All manual rows remain unverified; automated engine tests and historical accessibility-tree captures are not substitutes.
The existing documented behavior gaps also need an explicit release-scope decision rather than a claim of complete Base UI parity.

## Verification and evidence

The polyfill implementation was committed before the reduction pass.
The [reduction report](benchmark/REDUCTION-2026-09-03.md) records retained improvements, rejected candidates, measurements, and the subsequent CI repairs.
The private AUI Skill/release/catalog inconsistencies and the Firefox menubar pointer-state failure are fixed.
AUI remains excluded from the public workspace inventory and release choices.

At implementation commit `267992547de69eb0b9a2f7ac33dbd69a7c250918`, [CI run 33836755336](https://github.com/serve-tools/web-tools/actions/runs/33836755336) passed all five jobs: Node 22, Node 24, Node 26 full verification, Bun, and Deno.
Final local browser verification passed 4,687 tests with one existing native-feature skip; thirty consecutive focused Firefox menubar suites also passed.
The release metadata update requires a fresh successful CI run before merging and publishing.

The earlier nine-package and five-package polyfill tarballs installed into isolated consumers with scripts disabled and no workspace links.
Strict NodeNext type checks, runtime ownership and native-selection checks, and three-engine polyfill production smoke passed.
These earlier tarballs are not the publication artifacts: the release workflow must rebuild, verify, and pack the final merged commit.
Audit that immutable artifact and repeat the isolated consumer checks before approving publication.

## First-release bootstrap

`@serve-tools/client-dom-fragment`, `@serve-tools/ponyfill-composites`, `@serve-tools/polyfill-composites`, `@serve-tools/ponyfill-observable`, and `@serve-tools/polyfill-observable` do not yet exist on npm, so npm cannot attach a trusted publisher to them.
Dispatch the release workflow in `bootstrap` mode to verify, pack, and sign the selected tarballs under the protected `npm` environment without publishing them.
The immutable release artifact retains each exact tarball, while `provenance-<tarball>` contains its matching npm-compatible provenance bundle.
A maintainer completes npm 2FA through interactive `npm login`, then publishes the verified tarball with `npm publish <tarball> --access public --tag latest --provenance-file <bundle>`.
Run that command from a clean temporary directory with an isolated npm config that has no `provenance` setting, because the repository `.npmrc` enables `provenance=true` and npm does not allow any explicit `provenance` setting with `--provenance-file`.
This path must not create a granular access token or add `NPM_TOKEN` to GitHub.
After verified first publication, configure npm Trusted Publishing exactly for repository `serve-tools/web-tools`, workflow file `release.yml`, and environment `npm` so later releases use the protected OIDC workflow.
This is a staging constraint for these first versions only, not a permanent alternative to Trusted Publishing.

## Authorized-release procedure

1. Commit and push the final version metadata and this plan; wait for all CI jobs on the exact commit to pass.
2. Merge the reviewed PR normally, without bypassing protections, and require CI on the resulting `main` commit to pass.
3. Recheck npm and freeze the exact thirteen package/version pairs above; stop if the registry changes the intended batch.
4. Dispatch the workflow once with `package=all` and mode `bootstrap`, then approve only the verified protected-environment attestation deployments.
5. Download the immutable release artifact and the five first-release `provenance-<tarball>` artifacts, then verify each tarball, SHA-256, package name, version, and one-subject provenance bundle before interactive npm publication with maintainer 2FA.
6. Configure npm Trusted Publishing for each verified first release.
7. Dispatch the provenance-enabled release workflow on that exact `main` state with `package=all` and `tag=latest`.
8. Wait for preparation to pass and publication to pause at the required `npm` environment review.
9. Before normal environment approval, require the workflow SHA to match the reviewed `main` commit, download its sole `release-<run id>` artifact, and compare its ordered plan against the frozen list.
10. Reject missing or extra packages, tarballs, or checksum files; verify every SHA-256 and every tarball's embedded package name/version, and repeat packed-consumer checks.
11. Approve only that verified pending deployment through the normal environment review; do not bypass the gate or weaken provenance.
12. Verify all published versions, `latest` tags, tarball integrity, provenance, and a fresh registry-only consumer installation.
13. After any partial failure, re-query registry state and resume only still-unpublished versions using a freshly verified plan.

The `all` selector alone is not a release-scope guard.
It is permitted here only with the exact immutable-artifact comparison before the required environment approval; an unexpected public workspace must stop approval.
This replaces the earlier one-package-at-a-time recommendation without weakening the release boundary.
Do not create publishing credentials for this release; if a first-release provenance path remains unavailable, stop and request the specific required direction.
