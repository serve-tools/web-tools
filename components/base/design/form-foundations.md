# Minimal form foundations

This migration takes the separation of responsibilities in Reve's `FormAssociatedElement` and `FormFieldElement` as architectural inspiration.
It does not copy their implementation, import Lit, introduce a property-declaration framework, or change the existing Base control contracts.

## Ownership

`BaseElement` continues to own retained layout, signal bindings, and connection resources.
Non-form components do not acquire form listeners, validators, or field markup.

`FormAssociatedElement` owns one `ElementInternals` and the native form and validity facade.
Its constructor does not call subclass hooks.
It does not choose a value representation, restoration encoding, reset policy, accessibility role, or validation presentation policy.
Checkbox, Switch, and the existing Select/Combobox selection foundation share it.
Only this generally useful form foundation becomes a new public entrypoint.

The internal checked-control foundation shares binary activation, dirty checkedness, focus, effective disabledness, keyboard activation, and form synchronization.
Checkbox retains group membership, parent-checkbox behavior, and independent indeterminate presentation.
Switch retains switch semantics and its own layout.
Initialization must run only after the leaf's state exists, and must preserve pre-upgrade property order and failed-upgrade cleanup.
Inherited fieldset disabledness must not overwrite the author's `disabled` attribute.

The internal native-field foundation shares the reflected boolean properties, native validity facade, shadow-root creation, and state synchronization used by Number Field and OTP Field.
Input discovery, recovery, reset observation, and lifecycle scheduling remain private to each leaf rather than becoming a new hierarchy of hooks.
It never becomes another form-associated owner.
Number Field retains stepping, pointer repetition, and proposal transaction policy.
OTP Field retains its single editor and presentational segment policy.
Replacement, reset, disconnection, and document adoption retain their existing observable behavior.

`FieldElement` remains a coordinator around an authored native or form-associated control.
It is not renamed to `FormFieldElement` and does not become an input superclass.
A new owned-control field shell, validation presentation modes, declarative property metadata, and the multi-input Slider are outside this first extraction.
They require separate consumer evidence and must not be smuggled into a behavior-preserving migration.

## Initialization

The new public facade does not automatically replay properties assigned before custom-element definition.
Recovery belongs to the concrete registered class, after its private state has initialized, because setters may depend on that state.
Existing Base controls retain their established recovery order.
For a new directly registered subclass, this is sufficient for the four common reflected properties:

```ts
class ExampleControl extends FormAssociatedElement {
	constructor() {
		super();
		const properties = this as unknown as Record<string, unknown>;
		for (const property of ["name", "disabled", "readOnly", "required"]) {
			if (!Object.hasOwn(this, property)) continue;
			const value = properties[property];
			delete properties[property];
			properties[property] = value;
		}
	}
}
```

Include any component-specific public properties in the appropriate dependency order.
Do not put this replay in an intermediate constructor if further subclasses override those setters and need their own initialized state.
The checked-control superclass also exposes internal protected commands in generated declarations; these are not supported extension hooks.
Only documented public foundation hooks, such as `synchronizeValidity()`, are intended for consumers.

## Acceptance

The unchanged-runtime baseline passed 1,808 browser tests in 126 files across Chromium, Firefox, and WebKit, with one existing platform skip.
The package source include pattern needed an explicit dot-prefixed TypeScript glob before that baseline could build.
The public type fixtures are explicitly included in the package's test typecheck.

Acceptance requires preserved component behavior, public subclassing and export tests, targeted adversarial tests, package checks, independent review, and repository verification.
Size comparisons include the shared foundations and imported dependencies, not just the leaf files.
Runtime measurements use frozen baseline and candidate production artifacts with identical workloads and validation.
Source reduction alone is not evidence of faster execution.

This work does not close unrelated Base UI feature gaps, the manual assistive-technology matrix, or the package publication hold.

## Validation results

The final implementation passes 1,862 browser tests across Chromium, Firefox, and WebKit in 135 files, with one existing platform skip.
The tests include direct and pre-definition construction, subclass private-state initialization, form ownership, custom validity, fieldset disabledness, reset and restoration, group transactions, native-input replacement, adoption, and cleanup after setup failure.
Base build and typecheck, package export/type checks, repository package lint, formatting, lint, and consumer Skill checks pass.
An independent read-only review found no remaining correctness blocker within this migration's scope.

Full repository `npm run verify` was attempted but stops at unrelated TypeScript errors in client packages and Lit: dot-prefixed source files are absent from their project include lists, and several shared declarations cannot resolve DOM types.
Those files are part of separate existing work and were not changed by this migration.
The repository-wide verification gate therefore remains open; passing Base checks is not a claim that the whole checkout is ready to commit.

Across the eight affected runtime files, including all three new foundations, source falls from 3,100 to 2,728 lines.
Checkbox falls from 703 to 275 lines; Switch falls from 536 to 65.
These counts include comments and blank lines and are maintenance measurements, not executable-size or runtime evidence.

The first shared implementation was rejected because it added too many inherited hooks, called new overridable methods during construction, and imposed unnecessary single-component bundle overhead.
The revised native foundation shares only the facade and pure helpers; the checked foundation uses a fixed per-class behavior adapter and private initialization paths.
The final design still trades some individual Checkbox/Switch bundle cost for shared behavior in consumers that use both.
It does not establish a universal bundle-size advantage.

### Production bundle size

These identical registration fixtures include each component's full imported runtime, with production replacement, tree shaking, and Rolldown 1.2.7 minification.
Raw minified JavaScript is the primary executable-weight measure; gzip is a separate transfer measure.

| Consumer                                 | Baseline raw bytes | Final raw bytes | Raw difference | gzip difference |
| ---------------------------------------- | -----------------: | --------------: | -------------: | --------------: |
| BaseElement                              |             18,442 |          18,442 |              0 |               0 |
| Checkbox                                 |             26,402 |          28,010 |         +1,608 |            +344 |
| Switch                                   |             24,418 |          25,529 |         +1,111 |            +301 |
| Checkbox + Switch                        |             32,105 |          28,507 |         −3,598 |             −79 |
| Number Field                             |             27,518 |          27,439 |            −79 |             +15 |
| OTP Field                                |             23,672 |          23,737 |            +65 |             +49 |
| Field + Number Field + OTP Field         |             40,424 |          39,604 |           −820 |              −5 |
| Checkbox + Switch + Field + Number + OTP |             53,806 |          49,394 |         −4,412 |             −76 |

The mixed consumer is 8.2% smaller in raw executable bytes, but gzip savings are only 76 bytes.
Checkbox alone is 6.1% larger in raw bytes and Switch alone is 4.5% larger.
This is a measured sharing tradeoff, not an unqualified weight improvement or a comparison with Base UI.
The bare BaseElement bundle is byte-identical.

### Runtime acceptance remains open

The first complete comparison used eight counterbalanced pairs across 16 mount, property-update, and reconnect workloads.
Its predeclared 5% median and 10% p95 regression gates did not pass: 10 of 32 judgments were inconclusive, 19 ruled out material regression without establishing a practical improvement, and three reported credible improvements.
No judgment established a material regression, but that is not equivalent to passing acceptance.
Checkbox mount-1000 was a particular concern: its baseline/candidate median ratio was 0.950 with a 95% interval of 0.933–0.967.
Further review identified nonstationary mount timings and insufficient warmup in this run, so its apparent improvements are not a final performance claim.
The exact run and its source artifacts remain preserved rather than replaced by later results.

Subsequent code review corrected a stale group-validity cache and restored Checkbox's four literal form-restoration strings instead of constructing a string on every synchronization.
The current candidate passes the 1,862-test browser suite described above.
It has not passed a replacement formal performance comparison.

A separate bounded calibration used four pairs, eight mount workloads, fresh Chromium processes for each condition/workload, adjacent counterbalanced conditions, and 128 observations per case.
All 8,192 observations passed semantic, isolation, precision, and source-hash checks.
The predeclared stable-suffix rule passed 62 of 64 cases and failed two baseline cases: Checkbox mount-100 (factor 1.1407) and OTP mount-100 (factor 1.1525), against a maximum factor of 1.10.
The calibration therefore failed closed and no replacement formal run was launched.
No observations were removed and no threshold was relaxed to obtain a pass.

Runtime acceptance needs further reviewed calibration or a suitably controlled measurement environment.
This is a JavaScript-completion study of Base before and after the extraction; it does not measure paint, trusted input latency, assistive technology, or performance against Base UI.

Evidence is retained outside the repository in the `base-foundation-migration-2026-09-04` artifact directory.
Its `measurements/formal-v2-complete/`, `measurements/calibration-v3-complete/`, and `measurements/candidate-v4/` directories preserve failed-run disclosures, source and production snapshots, raw observations, protocol scripts, analyses, bundle sizes, and input hashes.
The package's release hold and the repository verification gate remain in place.
