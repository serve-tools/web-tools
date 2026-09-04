# Release preparation — September 3, 2026

This is a local release recommendation, not authorization to commit, push, publish, or change npm tags.
The nine prepared versions were checked directly against npm on September 3, 2026 and remain unpublished; recheck immediately before any release.

## Prepared release batch

The requested batch includes these nine packages, including Observable, Composites, and the Skill selector under their current names and documented contracts.
This is preparation only: do not publish, push, or dispatch the release workflow without separate authorization.
When authorized, use the existing provenance-enabled release workflow, selecting each package explicitly.
The order below is compatible with their dependency graph; DOM Fragment must be available before Signal DOM, and Signal DOM before the Client Signals umbrella.

| Package                            | Prepared version | Change                                                                                                            |
| ---------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@serve-tools/client-dom-fragment` | `0.1.0`          | First release of reusable DOM regions, including hidden-region ancestry and exact region lookup.                  |
| `@serve-tools/signal-dom`          | `0.2.0`          | Reconnectable binding scopes and the opt-in `/template` renderer with persistent `html` and managed `scopedHtml`. |
| `@serve-tools/signal-db`           | `0.2.2`          | Patch releasing the retained-query/editor-draft consumer guidance and recipe.                                     |
| `@serve-tools/signal-shared-db`    | `0.3.2`          | Matching retained-query/editor-draft guidance for shared-worker updates.                                          |
| `@serve-tools/client-signals`      | `0.3.0`          | Already prepared, unpublished umbrella release selecting Signal DOM `^0.2.0`.                                     |
| `@serve-tools/client-webtransport` | `0.1.3`          | Legacy shared-datagram writable compatibility while preserving independent-queue capability checks.               |
| `@serve-tools/ponyfill-observable` | `0.0.1`          | First release with independent cold executions, explicit imports, and documented proposal differences.            |
| `@serve-tools/ponyfill-composites` | `0.0.1`          | First release with documented module-local structural identity and native-proposal limitations.                   |
| `@serve-tools/skills`              | `0.0.6`          | Updated package selection and availability guidance, including the new packages.                                  |

The WebTransport and database patch versions were advanced locally and synchronized with the lockfile.
Their previous local versions were already published and cannot be overwritten.
The September 2 artifact comparison found the database JavaScript and declarations byte-identical to their published `0.2.1` and `0.3.1` artifacts; this pass did not modify that runtime, and the shipped guidance changes justify the patch releases.
No dependency-wide version rewrite is needed because existing compatible ranges already admit these patches.

## Hold separately

| Package or work                     | Reason                                                                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@serve-tools/aui@0.1.0`            | Automated verification passes, but the [accepted plan](components/aui/design/plan.md#release-holds) still requires mount-performance and manual assistive-technology work. The new `/template` renderer is opt-in, not a migration of existing components. |
| Agent benchmark reports and harness | Repository research/tooling, not a package release. Preserve frozen results; they do not justify replacing the published Skills wholesale.                                                                                                                 |

An AUI preview is a separate decision requiring explicit narrower preview criteria, not an implicit waiver of the existing release gates.
The independent `DisposableElement` remains internal; publishing the template entrypoint does not make it a supported component base.
Observable and Composites are not held for renaming or a preview-tag decision: the requested first releases retain their current names and intentional contracts.
Their initial versions do not promise exact native-proposal fidelity.

## AUI work before release

The [repeated-mount diagnostic](components/aui/benchmark/RESULTS.md) found that full validation after every sample perturbed later mount measurements: the paired mount-median ratio was 3.931, with a 95% interval of 3.067–5.037.
This AUI-only result is not a production speedup or a new Base UI comparison, and it does not close the mount-performance gate.
The next performance step is a separately frozen, symmetric AUI/Base UI comparison that separates repeated validation effects while preserving semantic checks.
Only then select production optimizations using measured construction, connection, synchronization, and allocation costs.
The shared template renderer remains opt-in and does not accelerate the existing Checkbox implementation.
`scopedHtml(this)` now integrates tagged templates with the existing AUI layout scope; `html(owner)` remains persistent even inside a layout.
Both originate in `@serve-tools/signal-dom/template`, with AUI's `/template` retained as a compatibility re-export.
Failed layout construction rolls back managed template listeners and directives, while ordinary disconnect only suspends reactive observation.
The base element does not import the parser, and no asynchronous signal conversion was made to native checkedness, validity, form values, or event ordering.
Retained-computation scheduling and source/read/commit changes remain separate benchmark and compatibility work, not prerequisites for releasing Signal DOM's current managed adapter.

The [accessibility acceptance checklist](components/aui/design/accessibility.md) covers Chrome, Firefox, and Safari.
It requires manual NVDA checks with Chrome and Firefox, and VoiceOver with Safari, with supplemental VoiceOver checks in Chrome and Firefox.
All manual rows remain unverified; automated engine tests and historical accessibility-tree captures are not substitutes.
The existing documented behavior gaps also need an explicit release-scope decision rather than a claim of complete Base UI parity.

## Evidence

- A clean `npm ci --ignore-scripts` passed with a writable temporary npm cache.
- The complete `npm run verify` passed again for this September 3 preparation pass, including Node/browser suites, Skills, release checks, and all workspace package checks; log: `/private/tmp/web-tools-ready-verify-2026-09-03.log`.
- Managed template tests cover disconnect/reconnect reconciliation, pending-write suppression, retained listeners and directives, `once` behavior, hidden/closed-root content, adoption, reentrant setup, disposal, rollback, and persistent siblings across Chromium, Firefox, and WebKit.
- The existing incidental writer-read tracking is preserved and characterized; source/read/commit semantics were not silently changed.
- The Composites getter-replacement regression failed during the first verification attempt and was repaired by restoring intrinsic snapshots; its existing 12 tests and the final complete verification pass.
- Observable's source type now rejects primitive inputs like its existing runtime; Composite's flat primitive-literal overload preserves literal types while retaining ordinary array and nested-object mutability.
- The eight runtime packages passed `publint` and Are the Types Wrong with the ESM-only profile; the documentation-only Skill package passed its package-content check.
- All nine prepared tarballs installed together into a fresh consumer outside the monorepo with scripts disabled and no workspace links.
- That isolated consumer passed strict NodeNext TypeScript compilation and imported all eight runtime entrypoints plus Signal DOM's new `/template` subpath in Node.
- Consumer runtime checks confirmed independent Observable executions, Composite identity and shallow freezing, resistance to getter-time intrinsic replacement, shared fragment-constructor identity, and no global installation.
- The installed Skill selector includes the new template subpath and labels AUI as workspace-only and unpublished.
- A minified bundle/module-graph check confirms neither AUI's base entrypoint nor Signal DOM's main entrypoint imports the tagged parser; this is not a runtime-performance claim.
- Skill validation, release-planning tests, TypeScript-reference validation, and diff whitespace checks passed.

The refreshed nine-package tarballs and SHA-256 files are in `/private/tmp/web-tools-ready-release-OzlQcV`, and the consumer is in `/private/tmp/web-tools-ready-consumer-1Kb7NM`.
Registry and bundle-check receipts are in `/Users/jonathan/Documents/Codex/outputs/aui-managed-template-2026-09-03`.
The previous September 2 tarballs are superseded by this preparation pass.
They are temporary audit artifacts; the release workflow must regenerate verified tarballs from the approved commit.
Full browser behavior was verified in the repository, not repeated inside this isolated Node/type consumer.
The existing native-feature skip and unused lint-suppression warning are not release failures.

## Authorized-release procedure

1. Obtain separate approval for commit/push and the exact nine-package batch; none is authorized by this preparation request.
2. Organize the validated working tree into reviewable commits without dropping the unrelated staged work or required workspace integration.
3. Push the approved state to `main`; release preparation verifies that committed checkout again.
4. Recheck npm versions, then dispatch the existing workflow once per package, sequentially in dependency order, with the exact package/version pairs above and the intended `latest` tag.
5. Verify published versions, tags, tarballs, provenance, and consumer installation; resume only unpublished versions after any partial failure.

**Do not use the workflow's `all` selector for this batch.**
It selects every unpublished prepared version, including the held AUI package.
No Git or registry mutations were made while preparing this plan.
