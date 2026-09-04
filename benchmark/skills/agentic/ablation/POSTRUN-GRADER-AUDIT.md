# Post-run grader fairness audit

This audit is source- and outcome-blind.
It compares only the frozen prompts in `tasks-a.mjs` and `tasks-b.mjs`, the four tasks' smoke and hidden checks, and the relevant public package source and documentation.
It does not use fixtures, alternate solutions, benchmark helpers or conditions, live records or outcomes, blind artifacts or reviews, or earlier grader audits.

The four reviewed cases contain unannounced requirements.
Official scores should remain unchanged.
Any corrected-program recheck should be labeled **exploratory** and reported separately from the frozen benchmark result.

## 1. `protocol-framed-audit`: required error class for invalid chunks

**Finding: confirmed defect.**

The prompt requires `chunks` to be a dense `Array` of `Uint8Array` values and requires validation, frame-length, deserialization, and EOF errors to propagate.
It names `RangeError` only for an incomplete final prefix or payload.
It does not prescribe `TypeError` for a non-`Uint8Array` element or a sparse element.

The hidden checks require `TypeError` for both a `DataView` element and an array hole.
That is stricter than the frozen wording.
Another synchronously thrown validation error is a legitimate implementation of the stated contract.
This matters because the public `FrameDecoder.push()` accepts any `ArrayBuffer` or `ArrayBufferView`, including `DataView`, so the task-specific `Uint8Array` restriction must be supplied by the solution rather than inherited with a documented package error class.
The public deserializer can also report malformed wire data with errors other than `TypeError`.

**Minimal fair correction:** preserve the two invalid-input calls but remove the constructor matcher:

```js
assert.throws(() => decodeAuditChunks([new DataView(new ArrayBuffer(4))]));
assert.throws(() => decodeAuditChunks(new Array(1)));
```

Keep the explicit `RangeError` assertion for incomplete EOF and the generic malformed-payload assertion.
This still rejects solutions that accept a view of the wrong type, silently skip a hole, omit deserialization, or omit `finish()`.
An exploratory correction should additionally retain one valid fragmented/coalesced sequence so a blanket throw cannot pass.

## 2. `observable-cold-receipts`: synchronous versus asynchronous invalid-input failure

**Finding: confirmed defect.**

The prompt says both arguments must be functions and says the successful result resolves a `Promise`.
It does not say whether invalid arguments throw before a promise is returned or reject a returned promise.
The current form evaluates `collectReceipts(...)` before `assert.rejects()` receives its argument, so a valid synchronous validation throw escapes the assertion and fails the grader.

The prompt also does not explicitly prescribe `TypeError` as the error class.
`TypeError` is conventional for this validation, but exact-prompt grading should not use convention to exclude another thrown validation error.

**Minimal fair correction:** defer the call through a promise and require failure without fixing its class:

```js
await assert.rejects(Promise.resolve().then(() => collectReceipts(null, () => {})));
await assert.rejects(Promise.resolve().then(() => collectReceipts(() => 1, null)));
```

This accepts either a synchronous throw or an asynchronous rejection and still fails an implementation that resolves or returns normally for invalid input.
If the benchmark owners choose to treat `TypeError` as an intended cross-task convention despite its omission here, the narrower timing-only repair is the same wrapper with `TypeError` retained as the second argument; that interpretation is ambiguous and should not be used for an adverse official-score change.

An exploratory correction should keep the existing successful two-consumption case, same-recipe identity check, and exact teardown order so permissive invalid-input handling cannot conceal a missing cold execution or teardown.

## 3. `observable-event-cancellation`: pre-aborted subscription count and invalid-input errors

### Pre-aborted subscription count

**Finding: confirmed defect.**

The prompt requires a pre-aborted signal to yield an empty inactive observation.
It does not require `Observable.prototype.subscribe` to be invoked for that call.
An implementation may validate the inputs and return the exact `{ seen: [], stop }` facade with an already-aborted private controller before subscribing.
That has the required externally observable behavior and avoids acquiring a listener.

The package documentation says that subscribing with an already aborted signal still invokes a custom producer with an inactive subscriber, and the public `when()` producer then returns before installing a listener.
That documents one valid implementation path; it does not make the internal subscribe call observable task behavior.
Requiring the instrumentation counter to advance for the pre-aborted call therefore excludes a valid early-return implementation.

The exact count of two after the two active observations is also an implementation-topology restriction.
The public `Observable.map()` implementation creates a derived recipe whose producer calls `this.subscribe(...)` on its upstream source.
A permitted `when(target, "note").map(event => String((event as CustomEvent).detail)).subscribe(...)` pipeline therefore invokes the instrumented `Observable.prototype.subscribe` twice for one active observation: once for the derived recipe and once for `when()`.
Two active `watchUntilAborted` calls can legitimately produce a count of four while installing only the two owned event listeners required by the task.

**Minimal fair correction:** use a lower bound at both instrumentation points instead of an exact topology count:

```js
assert.equal(subscriptions >= 2, true);

// After constructing the pre-aborted observation:
assert.equal(subscriptions >= 2, true);
```

Also call `inactive.stop()` twice and verify that later events still leave `inactive.seen` empty.
The event-order checks, exact two listener removals, and cancellation checks remain the authoritative behavior checks and continue to reject direct-listener implementations and missing ownership for active observations.
The lower bound still establishes that the package subscription API was used for the two active observations without prescribing the number of permitted operator layers.

An exploratory corrective regression should include both a saved implementation that uses the direct `when(...).subscribe(...)` pipeline and one that uses `when(...).map(...).subscribe(...)`.
It should also include the pre-aborted early-return form.
All three should be judged by the same event, cancellation, listener-removal, inactive-result, and idempotent-stop semantics rather than by an exact subscribe-call count.

### Invalid target and signal assertions

**Finding: error timing is fair; the required class is unannounced.**

`watchUntilAborted` has a synchronous object return, and the prompt requires both inputs to have specific platform types.
A synchronous throw is the natural observable way to reject invalid input before returning the required facade, so `assert.throws()` is consistent with the signature and validation requirement.
The prompt does not say the throw must be a `TypeError`.

**Minimal fair correction:** keep synchronous failure checks but remove the constructor matcher:

```js
assert.throws(() => watchUntilAborted({}, new AbortController().signal));
assert.throws(() => watchUntilAborted(target, {}));
```

This continues to reject implementations that accept either invalid input while avoiding an unstated error-class requirement.

## 4. `fixed-ping-client`: arrays as ping init

**Finding: confirmed defect.**

The frozen prompt says a supplied `init` must be a non-null object.
In JavaScript, an array is a non-null object.
Unlike other frozen prompts that explicitly say “non-array” or “non-null, non-array,” this task does not exclude arrays.
The hidden check nevertheless requires `ping([])` to reject with `TypeError`.

The public static-client implementation rejects arrays as request-init dictionaries, but that package implementation detail does not amend the task wording.
A solution can normalize the task's accepted object into the plain request-init object passed to the static client while preserving `signal` and headers.
Requiring use of the static client does not announce that the facade must expose every runtime restriction of its nested `init` parser unchanged.

**Minimal fair correction:** remove `[]` from the invalid-init rejection loop, retaining `null` and a primitive.
Add a bounded positive alternate-form check that `await client.ping([])` follows the same successful request path as an empty object.
For stronger coverage without broadening the contract, an array may be given own `headers` and `signal` properties and the check can verify that the non-`accept` header and signal pass through while method and `Accept` remain client-owned.

The existing ordinary-object request check should remain authoritative for GET ownership, JSON `Accept`, header pass-through, signal propagation, origin-root URL resolution, declared statuses, response-shape rejection, abort identity, and network-error identity.
The `null` and primitive cases still catch implementations that omit the stated non-null-object validation.

## Correction-program boundary

The corrected assertions should live in separate exploratory programs rather than modifying the frozen graders or generating new model attempts.
Each exploratory program should exercise the saved artifact against both accepted alternate forms and the original semantic requirements listed above.
The result can diagnose whether an original failure was caused solely by grader strictness, but it should not replace, recompute, or silently revise the official score.

## Correction implementation review

This follow-up review covers only `postrun.mjs`, the regression-control snippets in `postrun-tests.mjs`, the frozen prompts, and relevant public package contracts.
It remains blind to measured artifacts, records, conditions, helpers, and outcomes.

**Decision: approved for bounded exploratory saved-artifact rechecks.**

### Fairness rewrites

`postrunTask()` returns a copied task with only `programs.hidden` replaced and leaves the frozen task inputs and original hidden programs unchanged.
Its exact-one-occurrence `replace()` guard makes each rewrite fail closed if the frozen assertion text drifts.
Unrelated tasks receive no fairness program, while the quality pass composes an approved fairness correction with a quality probe when both apply.

The four rewrites implement the audit decisions:

- `protocol-framed-audit` keeps both invalid-input calls and changes only their required error class from `TypeError` to any synchronous throw.
  The valid fragmented/coalesced case, one-decoder instrumentation, EOF `RangeError`, malformed-payload rejection, and `finish()` observation remain intact.
- `observable-cold-receipts` defers each invalid call through `Promise.resolve().then(...)` and accepts either a synchronous throw or returned-promise rejection without fixing the error class.
  A normal return still fails `assert.rejects`, and the cold-execution, same-recipe, mapped-value, cleanup-count, and cleanup-order checks remain intact.
- `observable-event-cancellation` changes both subscription-count assertions to the topology-neutral lower bound `subscriptions >= 2`, permits a pre-aborted early return, and changes only the two invalid-input error-class matchers to generic synchronous throws.
  It additionally calls the inactive facade's `stop()` twice and dispatches another event, while the real event order, two listener removals, external abort, private stop, late-event exclusion, and active-observation package-subscription checks remain authoritative.
- `fixed-ping-client` removes only the array from the invalid-init loop, retains rejection of `null` and a primitive, and adds a positive `ping([])` success check.
  The existing ordinary-object request ownership and header/signal pass-through checks, status handling, response validation, URL resolution, abort identity, and network-error identity remain unchanged.

The regression controls cover the important valid alternatives: a generic chunk-validation error, synchronous generic callback validation, pre-aborted early return, `when(...).map(...).subscribe(...)`, and accepted array init.
Each is expected to fail the frozen hidden program and pass the corresponding exploratory correction.
The `map()` control is particularly material because the public implementation subscribes once to the derived recipe and once upstream, proving that an exact prototype-call count is not a task behavior.

The targeted nature of the rewrites preserves rejection of actual semantic omissions.
They do not relax successful output, framing, EOF, teardown, event delivery, listener ownership, request metadata, protocol status, or native failure-identity assertions.

### Additional quality probes

The `etag-status-handler` probe is fair and source-supported.
The prompt defines `service` with the enum values `api` and `worker` and requires adapter-owned canonical handling for route/schema failures.
The public HTTP handler treats a path-pattern candidate whose typed route codec rejects the parameter as a 400 adapter error, and the public default 400 body is `{ error: "invalid_request" }`.
Checking both GET and PUT prevents a string codec from silently widening the declared service domain.

The `protocol-framed-audit` quality probe is fair.
Every probed container or element violates the explicit dense `Array` of `Uint8Array` contract: an array-like object, a `Set`, `Uint16Array`, `ArrayBuffer`, and `DataView` are not accepted alternatives.
Using valid framed bytes for the latter cases ensures the check measures task-level type validation rather than accidental frame corruption.
The generic `assert.throws` remains consistent with the fairness correction and still permits any validation error class.

The `request-target-inspector` quality probe is fair under the prompt's explicit malformed-percent requirement.
The valid euro sequence demonstrates that well-formed UTF-8 percent encoding still decodes normally, while `%FF`, overlong `%C0%AF`, and truncated `%E2%82` cannot decode as valid UTF-8.
Returning the URL parser's replacement character for those sequences would conflict with the prompt's direction to return `null` for malformed percent encoding and its requirement to return decoded labels.
The public router's `URLSearchParams` path is forgiving here, so task-level prevalidation is needed to implement the stricter frozen wording.

### Saved costs and reporting boundary

The visible call site delegates each correction transform to `auditSaved`, marks the derived analysis `exploratory`, disables confirmatory adoption, writes into separate `fairness` and `quality` directories, and states that original measured costs and frozen scores remain preserved.
It does not launch new model attempts or mutate a cost field in the reviewed code.
The helper's internal implementation was intentionally not inspected under this review's blindness restriction, so this decision confirms the call-site preservation boundary rather than re-auditing `auditSaved` itself.
