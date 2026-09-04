# Toggle and toggle group proof

This proof tests whether AUI can keep a native button as the authored interaction surface while coordinating pressed state across custom-element boundaries.
It borrows the useful state and keyboard vocabulary of Base UI 1.7, but it does not claim API or behavioral parity with Base UI or the older donor implementation.

## References

- Base UI 1.7 [`Toggle`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/toggle/Toggle.tsx) and [`ToggleGroup`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/toggle-group/ToggleGroup.tsx) sources
- Base UI [`Toggle`](https://base-ui.com/react/components/toggle) and [`Toggle Group`](https://base-ui.com/react/components/toggle-group) documentation
- Donor AUI commit `080ad617486945851d0775278d1c8d215bdf75f7`, especially `src/mixins/toggle-mixin.ts` and `src/mixins/toggle-group-mixin.ts`

The donor established that toggle state and group selection are useful primitives, but its synthetic host button, generic `selected` vocabulary, manual keyboard click synthesis, descendant-wide membership, and sibling mutation during a bubbling veto do not fit this proof.
The Base UI sources provide the closer behavioral reference: a native button, `pressed`, nullable single selection, optional multiple selection, disabled propagation, orientation, looping focus, and roving keyboard navigation.

## Markup contract

The toggle controls its first direct native button.
Other direct buttons and nested buttons remain author-owned and do not activate it.

```html
<format-toggle value="bold">
	<button type="button">Bold</button>
</format-toggle>
```

The group recognizes only direct children that are upgraded `ToggleElement` instances.
Each group member must have an explicit, unique `value` attribute; `value=""` is valid and a missing attribute is not.
Nested groups remain independent because neither membership nor keyboard lookup searches descendants.

```html
<format-toggle-group aria-label="Formatting">
	<format-toggle value="bold"><button>Bold</button></format-toggle>
	<format-toggle value="italic"><button>Italic</button></format-toggle>
	<format-toggle value=""><button>Default</button></format-toggle>
</format-toggle-group>
```

`ToggleElement.button` is a read-only reference to the current controlled button.
`pressed` and `disabled` are reflected booleans, and `value` is string metadata for a direct group.
`ToggleGroupElement.values` returns a frozen DOM-order snapshot and accepts an array of unique strings.
Single mode, the default, accepts zero or one selected value; `multiple` permits more.
An explicit setter rejects duplicate requests, unknown or ambiguous member values, and multiple values in single mode before changing selection.

A value assigned before any child has upgraded is retained as pending upgrade state.
It commits silently after every requested value identifies exactly one upgraded direct child.
This supports either custom-element definition order, including detached upgrade.
If single mode is enabled while a multiple pending selection exists, the first requested value is retained.
Construction gates every child-coordination path until all recovered properties validate, so a failed group upgrade does not normalize or disable already-upgraded children.

## Native button ownership

The authored button remains the only focus and activation identity.
The toggle does not add a shadow button, synthesize Enter or Space clicks, or register a tag name.
Native button behavior supplies pointer, Enter, and Space activation.

While a button is controlled, the toggle owns `role="button"`, `aria-pressed`, and `type="button"`.
The `type` override prevents accidental form submission even when the author supplied `type="submit"`.
When the controlled target changes, each owned attribute is restored to its latest authored value if the author did not replace the owned value again.

The toggle owns the native `disabled` attribute only for its own `disabled` state, direct-group disabled propagation, or an authored button `disabled` attribute.
It checks `button.matches(":disabled")` at interaction and navigation boundaries so disabled fieldset ancestry is honored without copying inherited disabledness into the button attribute.
The group never changes a member's own `disabled` property.

The toggle exposes `:state(pressed)` and `:state(disabled)` for its direct, group, and authored-button disabled sources.
Inherited fieldset disabledness remains available through the native button's `:disabled` selector and is checked for every interaction without being copied into a potentially stale host custom state.
The group exposes `:state(disabled)`, `:state(multiple)`, `:state(horizontal)`, and `:state(vertical)`.

## Transactions and events

A native click proposes `!pressed` in this order:

1. A current direct group acquires a synchronous lease and captures its revision and full member snapshot.
2. The source toggle dispatches cancelable, bubbling, composed `beforechange` with frozen detail `{ pressed, sourceEvent }`.
3. The group rejects the stale interaction if child listeners changed group state or membership; otherwise it computes the complete proposed value set and dispatches its own cancelable, bubbling, composed `beforechange` with frozen detail `{ values, sourceToggle, sourceEvent }`.
4. After all listeners finish, the group revalidates exact direct membership, order, buttons, disabledness, values, pressed state, mode, and revision.
5. An accepted transaction commits every affected toggle synchronously.
6. The source toggle dispatches bubbling, composed `input`, then bubbling `change` before releasing the lease.

Child `beforechange`, `input`, and `change` events naturally bubble through a group.
The group does not emit a second `input` or `change` pair.
A listener interested only in the full-group proposal checks `event.target === group`; a group `input` or `change` listener reads the already committed `group.values` while `event.target` remains the source toggle.

Cancellation at either proposal level leaves the proposed transition unapplied.
Reentrant activation through the group proposal, commit, `input`, and `change` sequence is ignored.
If a listener explicitly changes properties or membership during a proposal, that programmatic change remains, but the stale interaction transaction aborts.
Property and attribute writes are silent and never impersonate user input.

## Focus and lifecycle

Connected groups own a roving `tabindex` across eligible direct buttons.
Arrow keys move focus on the configured axis, horizontal arrows follow computed text direction, Home and End move to the edges, disabled buttons are skipped, and `loopFocus` defaults to true.
Focus movement never selects a value.
Keyboard events from nested groups or embedded controls are ignored.

Mutation observers, document focus listeners, and keyboard listeners belong to one connection interval and are cleaned up on disconnect.
Disconnect releases group-owned `tabindex` values back to their latest authored values.
If one member restoration throws, the group clears its connection cache, attempts every remaining restoration, and reports the collected failure afterward.
The private group coordinator is registered for the element's lifetime in a `WeakMap`, so existing direct members still preserve disabled and single-selection invariants while the whole group is detached; it owns no external listener or observer.
Each toggle records the current coordinator as an ownership token, so cleanup from an old group cannot release or overwrite state already claimed by a new direct parent.
Detached membership edits reconcile on the next group or member operation or on reconnect.
Because disconnect clears active membership and stops observation, a membership snapshot rebuilt by a detached operation may retain those member handles until another operation or reconnect replaces the snapshot.
This proof does not claim immediate collection of detached members after otherwise unobserved structural edits.

Button and member checks use namespace, local name, and private handles rather than current-realm constructors.
Observers and event constructors come from the current `ownerDocument`, allowing adopted elements to reconnect in another document without rebuilding authored DOM.

## Proof boundary

This proof does not implement form-associated toggle values, toolbar semantics, required selection, automatic tag registration, or Base UI's React render props and class-name callbacks.
The native button may still participate in author code through its normal click event, but its controlled type is always `button` until ownership is released.
