# Release preparation — October 1, 2026

## Approval boundary

This plan prepares a local review branch and release candidates.
The user approved updating development dependencies, committing, and pushing the review branch on October 1.
npm publication requires a separate later approval.
The subsequent package documentation task deploys GitHub Pages through a validated merge to `main`.
Do not dispatch a release workflow, approve an npm deployment, or publish npm packages from this task.
This plan supersedes the historical September 4 batch and its publication instructions.

## Push candidate

The local review branch is `codex/stabilize-web-tools-2026-10-01`, based on `1c49c1b`.
A fresh fetch confirmed that `origin/main` matched that base before preparation.
The candidate preserves the accumulated Base components, Signal DOM callbacks, scoped registry, Vite integration, examples, tests, and benchmark work.
It also includes the stabilization fixes, dependency security patches, generated-screenshot cleanup, and current release metadata.

Push the approved review branch and open a PR against `main`.
Require the CI and TypeScript Adapter workflows to pass on the exact PR head before merging.
The repository currently has no branch protection or rulesets enforcing that check, so do not infer merge readiness from the ability to merge.
Require those workflows to pass again on the resulting `main` commit before considering publication.
A push or merge does not itself publish npm packages; the release workflow requires manual dispatch.
A merge to `main` also triggers the Pages package documentation and demo workflow.

## Prepared public package batch

A live npm registry audit on October 1 confirmed that every version below is unpublished.
The table follows the repository release planner's dependency order.

| Package                                         | Candidate | Change                                                                                                                                |
| ----------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `@serve-tools/signal-dom`                       | `0.3.0`   | Prepared template API migration plus reactive callbacks for child, attribute, and property bindings; event handlers remain listeners. |
| `@serve-tools/client-signals`                   | `0.3.1`   | Updates its Signal DOM dependency to `^0.3.0`; its root DOM re-exports are unchanged.                                                 |
| `@serve-tools/ponyfill-custom-element-registry` | `0.1.0`   | First release of explicit experimental scoped-registry installation, with association and insertion regression fixes.                 |
| `@serve-tools/polyfill-custom-element-registry` | `0.1.0`   | First release of the Firefox-only native-preserving automatic installer.                                                              |
| `@serve-tools/rolldown-typescript`              | `0.1.0`   | Existing unpublished compiler-adapter candidate; includes Vite/Rolldown integration, declarations, and consumer guidance.             |
| `@serve-tools/skills`                           | `0.0.7`   | Package-selection guidance for the new registry packages.                                                                             |
| `@serve-tools/vite-polyfills`                   | `0.4.0`   | Adds default scoped-registry detection and installation; prevents explicit runtime imports from recursively injecting installers.     |

Signal DOM must precede Client Signals.
The registry ponyfill must precede its polyfill, and both must precede Vite Polyfills.
Client Signals retains a patch version because it does not re-export the changed template subpath.
The Vite minor version reflects the additional default feature; published `0.3.0` and Skills `0.0.6` must not be overwritten.
Compatible existing dependency ranges remain unchanged.
Do not expand this batch merely because a later `package=all` invocation discovers another unpublished workspace.

## Exclusions and known limits

`@serve-tools/base-components` remains private and is excluded from release planning and workflow package choices.
Its existing bundle-size, manual accessibility, and scope acceptance holds remain in force; passing automated tests does not clear them.
See the [Base acceptance plan](components/base/design/plan.md#release-holds) and [accessibility checklist](components/base/design/accessibility.md).
Text Field uses its own shadow label surface rather than an external Field label.
The registry fallback remains experimental, retains iframe-backed realm limitations, and does not promise full native DOM parity.
Its [documented boundaries](ponyfills/custom-element-registry/README.md#boundaries) include invalid Document hierarchy cases that may prepare registry state before the native mutation throws.
Benchmark reports retain their original scope and measurements; this preparation makes no new performance claim.

## Local validation and artifacts

Preparation runs `npm ci --ignore-scripts`, full `npm run verify`, release planning, package packing, and isolated packed-consumer checks.
The stabilization pass also completed a fresh build and a zero-vulnerability dependency audit.
Known nonblocking lint and demo bundle-size warnings do not constitute release acceptance for private Base.
The local review artifacts are stored outside the repository in `~/Documents/Codex/2026-10-01/web-tools-release-preparation/`.
They include the exact package plan, tarballs, and SHA-256 checksums.
These are local review artifacts, not provenance-signed publication artifacts.
A later authorized release must rebuild and verify the final merged commit through the release workflow.

## Later publication procedure — separate approval required

1. Recheck registry state and freeze the exact still-unpublished subset of the seven package/version pairs above.
2. Confirm CI and TypeScript Adapter success for the exact `main` SHA, with no additional unreviewed changes.
3. The registry ponyfill, registry polyfill, and Rolldown TypeScript are first publications and currently have no npm package to which a trusted publisher can be attached.
   Bootstrap each using its exact package/version in workflow `bootstrap` mode.
   Bootstrap and publish the registry ponyfill before planning the dependent registry polyfill.
4. For each bootstrap, audit the immutable release plan, tarball, checksum, package metadata, and matching one-subject provenance bundle before the required `npm` environment review.
   A maintainer must later authorize and complete interactive npm 2FA publication of that verified tarball with its provenance bundle.
   Use an isolated npm configuration without a `provenance` setting, because the repository's `provenance=true` conflicts with `--provenance-file`.
   Do not create publishing credentials or bypass the protected environment.
5. After each verified first publication, configure its npm Trusted Publisher for `serve-tools/web-tools`, `release.yml`, environment `npm`.
6. Publish remaining existing packages through exact-package `publish` dispatches in dependency order, after registry visibility of their dependencies.
   Before each environment approval, audit the generated artifact against the frozen package/version and repeat packed-consumer checks.
7. Verify registry versions, intended tags, tarball integrity, provenance, and a fresh registry-only consumer installation.
   After partial failure, re-query registry state and resume only the still-unpublished candidates.

The `npm` environment is restricted to `main` and requires maintainer review.
Do not bypass it even when administrator bypass or self-review is technically available.
No release workflow is dispatched by the current preparation.
