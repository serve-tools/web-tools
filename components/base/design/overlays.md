# Native overlay contracts

## Scope

Popover, Tooltip, Preview Card, and Alert Dialog preserve authored native popup nodes and delegate top-layer state to the platform.
They do not register custom-element names, portal content, measure geometry, or replace CSS anchor positioning.
The baseline assumes native popover source association, native dialog modality, `CloseWatcher`, and CSS positioning support.

These contracts cover the corresponding Base UI 1.7.0 interaction families through natural DOM APIs rather than React roots, providers, portals, or render props.
They do not reproduce Base UI's change-reason vocabulary when the native platform does not expose a reason.

## Popover

`PopoverElement` selects the first direct HTML child carrying a `popover` attribute.
The author owns the popup's identity, content, popover mode, accessible relationships, and CSS geometry.
An external native invoker targets the popup itself rather than the custom-element host.

```html
<button popovertarget="account-menu">Account</button>
<x-popover>
	<div id="account-menu" popover>...</div>
</x-popover>
```

`popup` returns the current direct popup and `open` reads its native `:popover-open` state.
`show(source?)`, `hide()`, and `toggle(source?)` call the corresponding native popover methods.
Methods that require a missing popup throw `InvalidStateError`; replacing the direct popup takes effect immediately.

The host forwards the current popup's native `beforetoggle` and `toggle` as realm-correct `ToggleEvent` instances with the native old state, new state, source, and cancelability.
Canceling the host's opening `beforetoggle` prevents the native opening.
Native closing `beforetoggle` is not cancelable, so host cancellation cannot veto closing and the component never reopens a canceled native close.
Queued native `toggle` events may be coalesced by the user agent; the host forwards the events the platform actually delivers.

## Tooltip

`TooltipElement` selects a direct `slot="trigger"` element when present.
Otherwise it selects the first direct native interactive element: button, non-hidden input, select, textarea, link with `href`, or element with `tabindex`.
Its popup is the first direct HTML child carrying `popover`.

```html
<x-tooltip delay="600" close-delay="0">
	<button slot="trigger">Keyboard shortcuts</button>
	<div popover="manual" role="tooltip">Press <kbd>?</kbd> to view shortcuts.</div>
</x-tooltip>
```

While selected, the popup's popover mode is owned as `manual` and restored if the popup is replaced.
An absent popup role defaults to `tooltip`; an explicit authored role is preserved, so the author remains responsible for ensuring that override is suitable.
The component supplies a stable popup ID when absent, rechecks that ID for collisions in the popup's current tree scope after reconnection, and owns exactly one corresponding `aria-describedby` token on the trigger while preserving authored tokens.
Owned IDs, role defaults, popover mode, and description tokens are restored when the selected node is replaced.

Mouse and pen hover open after `delay`, focus opens immediately, and touch pointer hover is ignored.
Leaving the occupied trigger and popup closes after `closeDelay`; entering either before the delay expires cancels that close.
Each open tooltip owns a `CloseWatcher` in its current document realm, so Escape and other native close requests follow the platform's close-watcher grouping and stacking order.
The watcher is acquired only after the native opening is accepted, destroyed on closing, popup replacement, disconnection, and adoption, and a later opening creates a new watcher.
Imperative `show()` and an opening `toggle()` throw `NotSupportedError` synchronously when the owner realm lacks `CloseWatcher`; a closing `toggle()` remains a native close operation and does not require a new watcher.
Interaction and direct native openings are prevented before showing and report the same unsupported capability from their event dispatch.
The component never moves focus or traps it.
Programmatic opening uses the trigger as the native popover source.

## Preview Card

`PreviewCardElement` selects a direct `slot="trigger"` link with `href`, falling back to the first direct authored link with `href`.
The trigger remains an ordinary link; the component does not replace navigation, cancel clicks, add button semantics, or participate in forms.
The popup is the first direct HTML child carrying `popover`.

```html
<x-preview-card delay="600" close-delay="300">
	<a slot="trigger" href="/people/ada">Ada Lovelace</a>
	<article popover="auto">...</article>
</x-preview-card>
```

While selected, the popup's popover mode is owned as `auto` and restored if the popup is replaced.
Opening associates the authored link as the native popover source, so the author can use native source anchoring and CSS positioning.
Native auto-popover light dismissal remains in control.
Preview Card therefore does not install its own Escape handler.

Mouse and pen hover open after `delay`, focus opens immediately, and touch pointer hover is ignored.
The `closeDelay` keeps the card open while the pointer or focus crosses from the link into the popup and while either remains occupied.
Escape closes the card without moving focus into it.
Native focus restoration during closing is guarded from reentering the same popover operation.
Replacing the source link while the card is open closes the current popup before later interaction can use the replacement.

## Alert Dialog

`AlertDialogElement` selects the first direct authored HTML `dialog`.
It is a parallel native wrapper rather than a `DialogElement` subclass, so it exposes `showModal()` and `close(returnValue?)` without exposing the incompatible nonmodal `show()` operation.
`dialog`, `open`, and `returnValue` read the current native dialog.

```html
<x-alert-dialog>
	<dialog aria-labelledby="discard-title" aria-describedby="discard-description">
		<h2 id="discard-title">Discard draft?</h2>
		<p id="discard-description">This action cannot be undone.</p>
		<form method="dialog">
			<button value="cancel">Cancel</button>
			<button value="discard">Discard</button>
		</form>
	</dialog>
</x-alert-dialog>
```

The current dialog's role is owned as `alertdialog` and its prior authored role is restored when it is replaced.
Before opening, `showModal()` requires a nonempty authored `aria-label` or `aria-labelledby` and a nonempty authored `aria-description` or `aria-describedby`.
This is a syntax-level guard and does not claim to compute or validate the resulting accessible name or description.
Requiring description syntax is an intentionally stricter Base authoring contract than the alertdialog role's normative accessible-name requirement.

Native modal isolation, initial focus, focus restoration, Escape cancellation, nested top-layer behavior, and `form method="dialog"` submission remain native.
Pointer events outside the dialog do not create a component dismissal path.
The host forwards native `cancel` synchronously and preserves cancellation, and forwards the queued native `close` event.

## Lifecycle and replacement

Observers are scoped to each host and exist only during a connected interval.
Document listeners, timers, and observers use the current adoption realm and are released synchronously on disconnection.
Delayed operations retain the trigger and popup identities they were created for and verify connection and current identity before mutating native state.
Replacement restores component-owned attributes on the old node and synchronizes the new direct node without reconstructing authored content.
Replacing an open Tooltip or Preview Card trigger closes the popup so native source and focus restoration do not continue to represent a stale trigger.

Tooltip's manual popover uses its native `CloseWatcher` for close requests rather than a document key listener or overlay selector heuristic.
Native close-watcher grouping determines ordering with modal dialogs and auto popovers.
One close request may close multiple members created in the same native close-watcher group; Base does not promise one layer per Escape press.
Preview Card leaves Escape and light dismissal to its native auto popover.

Reentrant native popover operations retain their platform behavior.
Calling another show or hide operation from inside `beforetoggle` can throw `InvalidStateError`, and replacing a popup during an uncanceled native operation can affect that operation according to the user agent.
The wrapper does not catch, retry, reopen, or synthesize a settled state around those native constraints.

No overlay uses a document-wide mutation observer, per-frame geometry measurement, global registry, or retained portal.

## Deferred behavior

CSS collision avoidance, arrows, transform origins, viewport variables, and placement are author CSS concerns in this release.
The components do not provide transition-completion events or delay groups, multiple detached hover triggers, cursor tracking, geometric safe-polygon corridors, modal popovers, or fabricated dismissal reasons.
Tooltip and Preview Card provide delay-based pointer occupancy across the trigger and popup but do not sample pointer trajectories.
Assistive-technology evaluation remains required in addition to the automated role, relationship, keyboard, focus, and native-state tests.
