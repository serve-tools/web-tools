# Template migration review

This document records the September 4, 2026 production migration from owner-curried template calls to inert `html` descriptions.
Publishing and pushing remain on hold.
This migration is functionally integrated, but it does not yet satisfy the original release criteria.
The measured bundle-size increase and required manual acceptance are explicit review items, not waived gates.

## Contract

```ts
import { BaseElement } from "@serve-tools/base-components/base";
import { html } from "@serve-tools/base-components/template";
import { Signal } from "@serve-tools/signal";

class Counter extends BaseElement {
	count = new Signal.State(0);

	increment() {
		this.count.set(this.count.get() + 1);
	}

	protected layout() {
		return html`<button type="button" @click=${this.increment}>${this.count}</button>`;
	}
}
```

`html` constructs an inert description; it does not parse markup, install listeners, or subscribe to signals.
The base materializes a returned description inside its binding scope and supplies the element as the event-handler context.
Static template preparation can be reused without caching owners or dynamic values.
The base appends the completed fragment outside capture, allowing nested custom elements to own their own lifecycles.
The existing `layout(content)` imperative form remains compatible.

Disconnecting synchronously suspends subscriptions and releases connection resources.
Reconnecting retains layout nodes and reconciles current values.
A `DisposableStack` owns connection cleanups, and an AbortController is allocated only when its signal is requested.
Neither normal removal nor hiding content is terminal disposal of its template.

Outside a base element, `createFragment(result, owner)` is the explicit materialization boundary.
Inside `BindingScope.capture()`, the scope owns the view; outside capture, its caller retains the fragment and calls `dispose()` when finished.
Legacy `html(owner)` and `scopedHtml(owner)` remain deprecated compatibility adapters with their original ownership behavior.
Signal DOM's main-entrypoint functional DOM helpers remain supported; the preferred Base authoring API is the template tag.

## Component scope

All twelve production layout overrides use the tag: Avatar, Calendar, Checkbox, Field, Meter, Number Field, OTP Field, Progress, Separator, Slider, Switch, and Toast Region.
Native nodes exposed through public getters or used for pre-connection numeric parsing are preserved and inserted as template values.
The remaining components enhance authored DOM and intentionally do not invent new layouts.
The gallery counter, context/drop examples, standalone persistent-template demo, and compile-checked Base recipes use the new API.
Compatibility tests and frozen experiments can still exercise the old adapters; they are not recommended authoring examples.

## Correctness and distribution

The final integration passed the complete repository `npm run verify` gate: formatting, unused-code checks, workspace type checking, Node and three-engine browser tests, consumer Skills, release metadata, package analysis, and the repository's compiler-adapter checks.
The [final handoff verification log](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/verify-handoff.log) records the complete rerun after the benchmark corrections rather than only the Base subset.

Production conformance tests now exercise the shipped renderer instead of a second prototype implementation.
The old prototype sources are archived with their original experiment rather than kept as a competing implementation.
Independent adversarial tests cover nested template identity, duplicate occurrences, replacement disposal, reentrant setup, insertion failures, input preservation, owner-bound events, suspension, and explicit persistent-fragment parking.
Insertion-error review exposed two cleanup leaks; both were corrected before the final measurements.

The packed Signal DOM, Base, and Client Signals candidates were installed into an isolated consumer without workspace symlinks.
Strict TypeScript compilation and production-bundle browser checks pass in Chromium 151.0.7922.34, Firefox 153.0, and WebKit 26.5.
All 285 installed package metadata and distribution files match the final workspace packages.
The browser fixture checks event receivers, signal suspension and reconnection, input identity, Checkbox form submission, and shared scope ownership through the Client Signals umbrella.

WebKit 26.5 in the test environment does not provide native `DisposableStack`.
The gallery, browser tests, and external consumer explicitly load the resource-management polyfill; Base does not silently install global polyfills for consumers.
Native implementations remain in use where available.

## Executable weight

The matched one-Checkbox production consumer grew from 17,278 to 26,665 raw minified bytes.
Gzip grew from 5,752 to 9,088 bytes, and Brotli from 5,196 to 8,171 bytes.
The fixed Base UI incremental target remains 14,477 raw minified bytes; the new Base bundle is 12,188 bytes above it.
The current pinned Base UI rebuild yields an increment of 14,476 bytes, which does not move that target.
These Base weights do not include an optional resource-management polyfill, whose cost must be added for consumers that need it.

Returning a description makes the generic materializer reachable from the Base base, including when a particular component uses a static template.
A runtime fast path for templates without expressions avoids binding allocations, but does not let the bundler discard the generic renderer.
A bounded size investigation reproduced savings below 700 raw bytes; it did not identify an ordinary safe cleanup that closes the gap.
One small alternative would replace weak-owner scheduling with the shared effect scheduler, but its collectability behavior is unproven and it was not adopted.

Meeting the size target requires further architectural work, such as a separately optimizable static-template path or compilation, and reduction of the preexisting Checkbox dependency closure.
Even the pre-migration consumer exceeded the target by 2,801 bytes.
This migration must not be described as a bundle-size improvement or a smaller replacement for Base UI.

All raw bundles, input hashes, build metadata, browser checks, and the reproducible size investigation are retained in the [migration artifact directory](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04).

## Template performance

The [complete eight-pair production experiment](../benchmark/template/MIGRATION-RESULTS.md) passes its fixed median and p95 criteria.
Its paired estimates show approximately 42% less time to mount 1,000 elements and 59% less time for reconnection blocks than the frozen pre-migration fixture.
Update and state-preserving movement medians are slightly slower but remain within the predeclared 5% bound; all tail intervals clear the 10% bound.
Single-element cold timing remains below the precision requirement and supports no improvement claim.
This compares the template migration with its own baseline, not Base with Base UI, and does not measure layout or paint.

The separate [corrected current Checkbox comparison](performance.md#current-checkbox-comparison-september-4-2026) also passes all five workload median and p95 bounds across eight independent pairs.
Mounting 1,000 controls measures 8.4087 ms for Base and 50.9138 ms for pinned Base UI, with a paired Base UI/Base ratio of 6.041 and a 95% interval of 5.893–6.193.
The completed-update fixtures also favor Base; grouped observations describe block means, not individual interaction tails.
This resolves the measured Checkbox mount gate, but does not establish whole-library performance or cancel the size shortfall.

## Retention and accessibility

The [fresh five-pair retention experiment](retention.md#production-template-migration-september-4-2026) passes all 20 unchanged checks across all 36 public constructors.
It finds no added normal DOM nodes, listeners, or documents after garbage collection, no detached Signal writes, and 362,748 bytes of median heap growth within the 2 MiB budget.
The intentionally leaking positive control passes the sensitivity requirements.
This is bounded retained-heap evidence, not a claim that every possible component graph is leak-free.

The final production-gallery Chromium accessibility-tree capture passes all 80 semantic checks with zero page or console errors.
Its broad source lock matches before and after capture.
NVDA with Chrome and Firefox, VoiceOver with Safari, and the required manual keyboard and visual acceptance remain unverified.
Those checks require a suitable assistive-technology environment and human evaluation; automated tree assertions do not replace them.

## Release preparation

The registry was checked during this migration: `@serve-tools/signal-dom@0.2.0` and `@serve-tools/client-signals@0.3.0` already exist.
The candidate versions are Signal DOM `0.3.0` and Client Signals `0.3.1`; the latter updates its dependency on the compatible main-entrypoint API.
Base remains `0.1.0` and private, with a dependency on Signal DOM `^0.3.0`.
The Signal DOM demo uses the same workspace version.
No package is published by preparing these manifests.

Before approving Base, review the documented behavior differences in [coverage.md](coverage.md) and record the required manual assistive-technology results in [accessibility.md](accessibility.md).
Automated browser and accessibility-tree checks cannot establish NVDA or VoiceOver speech behavior.
Base's native composition choices do not imply complete React Base UI API or behavior parity.

The implementation and automated acceptance are ready for review, but publication is not approved.
The remaining release holds are the size shortfall, the manual acceptance matrix, the user's decision on documented behavior differences and unmeasured workloads, and explicit authorization to push and publish.
The size gap requires further architectural work to meet the original target; passing the runtime benchmarks does not resolve it.
No release-ready label should hide those limits.
