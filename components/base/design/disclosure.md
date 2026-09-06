# Collapsible and accordion contract

Status: implemented and verified in focused Chromium, Firefox, and WebKit browser tests.
This is a web-component contract informed by Base UI 1.7.0 and the donor Base; it is not JavaScript API parity with either project.

## References and provenance

- Base UI 1.7.0 [`Collapsible.Root`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/collapsible/root/CollapsibleRoot.tsx), [`Collapsible.Trigger`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/collapsible/trigger/CollapsibleTrigger.tsx), and [`Collapsible.Panel`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/collapsible/panel/CollapsiblePanel.tsx)
- Base UI 1.7.0 [`Accordion.Root`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/accordion/root/AccordionRoot.tsx), [`Accordion.Item`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/accordion/item/AccordionItem.tsx), [`Accordion.Trigger`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/accordion/trigger/AccordionTrigger.tsx), and [`Accordion.Panel`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/accordion/panel/AccordionPanel.tsx)
- Base UI [`Collapsible`](https://base-ui.com/react/components/collapsible) and [`Accordion`](https://base-ui.com/react/components/accordion) documentation
- Donor Base commit `080ad617486945851d0775278d1c8d215bdf75f7`, especially `src/elements/AccordionElement.ts` and `src/mixins/accordion-mixin.ts`

The donor supplied the useful `disclosures`, `open`, `title`, and `panel` vocabulary and the product requirement for authored headings and retained content.
Its heading click handler, rebuilt manual slots, and missing button and expanded-state semantics were not copied.
Base UI supplied the closer disclosure state, disabled propagation, single or multiple accordion value model, and trigger-panel relationships.
The implementation uses native elements and ordinary DOM events instead of React composition, controlled props, transition state, or render callbacks.

## Markup contract

A collapsible controls the first eligible trigger and the first direct panel.
An eligible trigger is either a direct native button or a native button that is itself a direct child of a direct `h1` through `h6` heading.
This permits natural document headings without searching through panels or nested disclosure families.
The panel is the first direct HTML element with `slot="panel"`.

```html
<recipe-collapsible value="ingredients">
	<h3><button>Ingredients</button></h3>
	<section slot="panel">
		<p>A list of ingredients.</p>
	</section>
</recipe-collapsible>
```

The heading and panel remain author-owned light-DOM nodes.
The component does not replace, move, clone, or remove them.
The `slot` value identifies the panel even though this component does not create a shadow slot.

An accordion coordinates only direct upgraded `CollapsibleElement` children.
Each selectable child needs an explicit unique `value` attribute; an explicit empty string is valid and an omitted value is not.
Missing or duplicate values are interaction-disabled so they cannot violate the group's expansion invariant.
Nested accordions and collapsibles remain independent.

```html
<recipe-accordion>
	<recipe-collapsible value="ingredients">
		<h3><button>Ingredients</button></h3>
		<section slot="panel">A list of ingredients.</section>
	</recipe-collapsible>
	<recipe-collapsible value="instructions">
		<h3><button>Instructions</button></h3>
		<section slot="panel">A list of instructions.</section>
	</recipe-collapsible>
</recipe-accordion>
```

Imports do not register tag names.
Applications explicitly associate their chosen names with `CollapsibleElement` and `AccordionElement` through `customElements.define()`.

## Collapsible state and native ownership

`button` and `panel` are read-only references to the current controlled nodes.
`open` and `disabled` are reflected booleans, and `value` is reflected string metadata for a direct accordion.
Property and attribute assignments are silent.

While controlled, the component owns the trigger's `id`, `type="button"`, `aria-expanded`, `aria-controls`, and effective native `disabled` attribute.
It owns the panel's `id`, `role="region"`, `aria-labelledby`, and `hidden` attribute.
If an author changes an owned attribute, the component observes the new author value and restores it when that node leaves the control, provided the author has not replaced the component's current owned value again.

The author button remains the only focus and activation identity.
Pointer, Enter, and Space activation come from the native button; the component does not synthesize a click.
The component's `disabled` state, its direct accordion's disabled state, invalid accordion identity, an authored button `disabled` attribute, and native disabled ancestry all prevent interaction.
The current native button is checked with `:disabled` at interaction and accordion-navigation boundaries, so a disabled fieldset is authoritative without copying its state to another control.

Closing sets the native `hidden` attribute without removing the panel or any of its descendants.
If focus is inside the panel, the component first tries to focus its trigger before hiding the panel.
When a disabled or missing trigger cannot receive focus and the document's active element remains inside the panel, the component calls `blur()` on that active element before hiding.
It rereads focus and open state after those synchronous callbacks, so it does not blur focus a listener moved outside the panel and does not overwrite a listener-authored reopen or accordion selection.
This applies to user interaction, direct property changes, and an accordion closing one disclosure as it opens another.

Firefox currently treats `blur()` on a host containing deep focus in a closed shadow root as a no-op.
Author code prevents access to that closed root, so this component cannot guarantee immediate deep-focus removal for that platform case without temporarily enabling another focus target.

The host exposes `:state(open)`, `:state(closed)`, and coordinated `:state(disabled)`.
The disabled custom state covers the host property, accordion propagation, invalid accordion identity, and an authored button `disabled` attribute.
It does not mirror inherited fieldset disabledness; use the authored button's native `:disabled` pseudo-class for that state.

## Accordion values and disabledness

`disclosures` returns a frozen DOM-order snapshot of upgraded direct children.
`values` returns a frozen DOM-order snapshot of open values and accepts an array of unique strings.
The default single mode permits zero or one open disclosure.
`multiple` permits several.

The `values` setter rejects duplicate, unknown, and ambiguous values before changing expansion.
A nonempty value assignment made before children upgrade remains pending until every requested value identifies exactly one direct disclosure.
Changing from multiple to single mode preserves the first open disclosure in DOM order.

Group `disabled` adds effective disabledness without changing each disclosure's own `disabled` property.
The group exposes `:state(disabled)`, `:state(multiple)`, `:state(horizontal)`, and `:state(vertical)`.

## Transactions and events

A native trigger click proposes the next state in this order:

1. The source collapsible dispatches cancelable, bubbling, composed `beforechange` with frozen detail `{ open, sourceEvent }`.
2. A current direct accordion computes the complete next expansion and dispatches a second cancelable, bubbling, composed `beforechange` with frozen detail `{ values, sourceDisclosure, sourceEvent }`.
3. After listeners finish, the transaction revalidates direct membership, node identity, values, disabledness, expansion, and group mode.
4. An accepted transaction commits every affected disclosure synchronously.
5. The source collapsible dispatches bubbling, composed `input`, then bubbling `change`.

Child events naturally bubble through the accordion.
The accordion does not emit a duplicate `input` or `change` pair.
A group listener distinguishes its complete-value proposal with `event.target === accordion` or with `"values" in event.detail`.

Cancellation at either proposal leaves the proposed transition unapplied.
Programmatic changes or structural mutations made during a proposal remain in place, but invalidate the stale user transaction.
The accordion holds one activation lease from before the child proposal through the group proposal, commit, `input`, and `change`.
Reentrant user activation from another direct disclosure is ignored during that complete interval.
Programmatic writes remain permitted, increment the coordinator revision, and make the outer user transaction stop before it can overwrite them.
The commit checks that revision and its captured direct membership after every disclosure write.
This also covers focus callbacks caused by returning focus before a panel is hidden: a callback may replace the selection or insert an already-open disclosure without allowing the stale outer commit to leave multiple panels open in single mode.

## Keyboard focus

Every eligible trigger remains in the normal tab order unless it is disabled.
Arrow navigation supplements ordinary Tab navigation; it does not install roving `tabindex` and never changes expansion.

Vertical accordions use Up and Down.
Horizontal accordions use Left and Right and reverse direction under inherited RTL.
Home and End focus the first and last enabled direct triggers.
`loopFocus` defaults to true; `loop-focus="false"` stops at either boundary.
Keyboard events from nested accordions, panel controls, and other descendants are ignored.

Base UI 1.7.0 retains `orientation` and `loopFocus` as deprecated no-op accordion properties after an ARIA Practices guidance update removed composite arrow navigation.
This package deliberately keeps functional arrow navigation because it is part of Base's accepted disclosure contract, while preserving every trigger in the ordinary tab sequence.

## Lifecycle and transition boundary

The direct-child and attribute observers and keyboard listener belong to one `BaseElement` connection interval.
They stop synchronously on disconnection and are recreated once on reconnection or document adoption.
Detached property reads and writes still reconcile direct membership and state without retaining a document listener or observer.
Disconnection also clears the accordion's strong member snapshot; detached coordination becomes demand-driven through a component getter, setter, child operation, or reconnection.
A direct child's cleanup does not query its unchanged detached coordinator, so whole-tree disconnection cannot recreate that cleared snapshot through callback ordering.
Private ownership tokens prevent cleanup from an old accordion from releasing state already claimed by a new direct parent.
Pre-upgrade properties are recovered before either element publishes its private coordinator.
Collapsible `value` is recovered before `open`, so a late-upgraded direct child enters its accordion with one coherent identity and state.
If invalid pre-upgrade properties make an accordion upgrade fail, no private controller remains registered and its already-upgraded children continue as standalone collapsibles.
Recovered values are validated against a read-only direct-member snapshot before normal expansion reconciliation, so the failed upgrade cannot close or otherwise normalize those standalone children first.

Passive structural edits to a detached tree do not have an observer.
They reconcile on the next component operation or reconnection.
If such an operation creates a new detached member snapshot and author code later changes that detached tree without another component operation, the snapshot may retain its previous members until the next reconciliation.
This implementation does not claim automatic collection for every author-edited detached graph and does not introduce an unmeasured WeakRef membership cache.

The panel identity and contents are always retained, including while closed and across reconnection.
Closing is immediate because native `hidden` removes the panel from layout.
Opening can use ordinary CSS entry animation after `hidden` is removed, but this contract does not keep a closing panel visibly mounted for an exit animation, measure height or width, or write geometry on animation frames.
Base UI's `keepMounted`, `hiddenUntilFound`, transition status, and panel-size CSS variables are not implemented here.
Those remain real parity gaps and require a separate transition and browser-find contract rather than weakening native hidden-state and focus guarantees.
