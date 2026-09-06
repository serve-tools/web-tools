# Checkbox Group and parent-control decision

Status: implemented against the Base UI 1.7.0 behavior reference with native custom-element form ownership.

## Reference and DOM API

The pinned reference is [`CheckboxGroup`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/checkbox-group/CheckboxGroup.tsx), [`useCheckboxGroupParent`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/checkbox-group/useCheckboxGroupParent.ts), and the group integration in [`CheckboxRoot`](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/src/checkbox/root/CheckboxRoot.tsx).
Base UI receives `value`, `defaultValue`, and optional `allValues` arrays through React context.
Base can inspect its direct DOM children, so it derives the complete value set and initial selection from authored checkbox elements.

```html
<app-checkbox-group aria-label="Notification channels">
	<app-checkbox parent>All channels</app-checkbox>
	<app-checkbox name="channel" value="email" checked>Email</app-checkbox>
	<app-checkbox name="channel" value="sms">Text message</app-checkbox>
</app-checkbox-group>
```

`values` is a frozen DOM-order snapshot of selected ordinary children.
Assigning a unique string array changes selection synchronously and silently.
Every participating ordinary child needs an explicit value attribute that is unique among ordinary direct children; an explicitly empty value is valid.
Missing or duplicate values do not participate, and assignments reject values that do not identify exactly one participating child.
An assignment made before children upgrade is retained until matching direct children become available.

The `checked` attributes on ordinary children supply initial selection and form-reset defaults.
A pre-upgrade own `values` assignment takes precedence after every group property has been recovered and validated.
Constructor recovery never coordinates or mutates children until all own group properties have recovered successfully.

## Form ownership and disabledness

The group is not form-associated and does not serialize an aggregate value.
Each ordinary `CheckboxElement` remains the sole owner of its name, checked value, optional unchecked value, external form association, reset state, restored state, and validation.
The parent checkbox is presentation-only and does not submit, even when it has a name.
This preserves normal repeated-name `FormData` without hidden inputs or duplicate aggregate entries.

Group `disabled` adds an effective restriction to every direct checkbox without changing each checkbox's own `disabled` property.
While effectively disabled, children leave the tab order, do not activate, validate, or contribute form values.
Removing group disabledness restores authored and fieldset-derived behavior.
Native disabled fieldsets continue to affect each form-associated child directly.

## Parent checkbox

The reflected boolean `parent` property and attribute mark a direct child as a select-all control.
Parent controls are excluded from `values` and derive their presentation from every uniquely valued ordinary child, including disabled children:

- checked when all ordinary children are checked;
- indeterminate when at least one but not every ordinary child is checked;
- unchecked when no ordinary child is checked.

Parent activation follows Base UI's disabled-option behavior.
Disabled checked children remain selected, and disabled unchecked children remain unselected.
From a partial selection, the first parent activation selects every enabled child, then the next clears every enabled child.
An accepted ordinary-child activation resets this mixed-state cycle.
Because parent presentation considers disabled unchecked children, selecting every enabled child can intentionally leave the parent indeterminate; the next parent activation clears the enabled children.

Programmatic `values` and child `checked` assignments are silent and may change disabled children.
Programmatic assignment to a grouped parent selects or clears enabled ordinary children while preserving disabled selections.

## Interaction transaction

Ordinary and parent activation begin a group lease before the source checkbox dispatches its child `beforechange` event.
The complete synchronous order is:

1. Capture direct membership, identities, checkedness, effective disabledness, and the intended transition.
2. Dispatch the source checkbox's bubbling, composed, cancelable `beforechange` proposal.
3. Revalidate the captured group and dispatch the group's bubbling, composed, cancelable `beforechange` proposal with immutable `detail.values`, `detail.sourceCheckbox`, and `detail.sourceEvent`.
4. Revalidate again and commit ordinary checkedness plus parent presentation as one silent group update.
5. Dispatch one `input` and `change` pair from the source checkbox after the full group state is visible.

The group emits no duplicate input or change pair.
Child proposals bubble through the group before the group's own proposal; filter with `event.target === group` or `"values" in event.detail` when handling only the group event.
Canceling either proposal leaves group state untouched and suppresses post-events.
Listener-authored programmatic writes are not rolled back; they invalidate the stale transaction instead.
Membership, value, disabledness, or checkedness changes during either proposal also invalidate the transaction.
The lease remains active through source input and change dispatch, so reentrant user activation of any member cannot begin another transaction.

## Lifecycle boundary

Connected groups use one local mutation observer to reconcile direct membership and relevant child attributes.
Disconnection stops observation, clears the membership cache before attempting every child release, and aggregates cleanup failures.
The private registries use weak keys and do not keep groups or children alive.

Detached groups retain selection and can still coordinate their current direct children on demand.
After detached structural edits, reading `group.values`, reading or writing a moved child's checkedness, or reconnecting reconciles membership and releases stale inherited disabledness.
There is no background document observer or strong global ownership graph.

Initial browser coverage exercises the contract in Chromium, Firefox, and WebKit.
Manual assistive-technology evaluation remains an accessibility release gate.
