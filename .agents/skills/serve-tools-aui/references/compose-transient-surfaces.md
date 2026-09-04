# Compose transient surfaces

Register application-owned names for `DrawerElement`, `ToastRegionElement`, and `ScrollAreaElement`.
Imports do not register tag names.

```ts
import { DrawerElement } from "@serve-tools/aui/drawer";
import { ScrollAreaElement } from "@serve-tools/aui/scroll-area";
import { ToastRegionElement } from "@serve-tools/aui/toast-region";

customElements.define("app-drawer", DrawerElement);
customElements.define("app-scroll-area", ScrollAreaElement);
customElements.define("app-toast-region", ToastRegionElement);
```

## Add snap gestures to a native dialog

```html
<app-drawer id="settings" side="right">
	<dialog aria-labelledby="settings-title">
		<div slot="handle" aria-hidden="true">Drag</div>
		<h2 id="settings-title">Settings</h2>
		<form method="dialog"><button value="done">Done</button></form>
	</dialog>
</app-drawer>
```

```ts
const drawer = document.querySelector<DrawerElement>("#settings")!;
drawer.snapPoints = [0, 0.5, 1];
drawer.showModal();
drawer.snapTo(0.5);
```

Keep exactly one direct native dialog and one direct `slot="handle"` child inside that dialog.
The dialog owns focus, modality, forms, Escape, cancel, and close.
Only the handle begins AUI pointer gestures.

Snap points are finite numeric fractions from zero through one.
The frozen `snapPoints` snapshot is sorted and duplicate-free; the default is `[0, 1]` and `side` defaults to `"bottom"`.
Render from `--aui-drawer-progress` and `--aui-drawer-offset`.

Programmatic `snapPoint` assignments and `snapTo()` calls are silent and do not close the dialog.
Handle gestures propose through cancelable `beforesnap` and report accepted state with `snapchange`.
A gesture to zero calls the dialog's native `requestClose()`, preserving cancel and close behavior.
Use `close()` for a programmatic close.

## Show authored toast nodes

```html
<app-toast-region id="notifications">
	<article id="saved" slot="toast" role="status" hidden tabindex="-1">
		Saved.
		<button slot="dismiss">Dismiss</button>
	</article>
</app-toast-region>
```

```ts
const region = document.querySelector<ToastRegionElement>("#notifications")!;
region.show("saved");
region.dismiss("saved", "application");
```

Use unique nonempty IDs on direct `slot="toast"` children.
`show()` retains and returns the authored node.
The default duration is 5000 milliseconds; use the region's numeric `duration`, `data-aui-duration` on one toast, or a `show()` option to override it.
Duration zero means persistent.
Calling `show()` again restarts the duration.

Pointer hover, focus within, document visibility, and connection state pause a running timer without losing its remaining time.
A native `slot="dismiss"` button dismisses with reason `"dismiss"`; its button type is owned as `button` and restored when released.
Programmatic `dismiss()` defaults to reason `"programmatic"`.
Cancelable `beforedismiss` precedes mutation, and accepted dismissal emits `toastdismiss` after the authored node becomes hidden.

Author `aria-live` or a standalone `role="status"` or `role="alert"` when the toast itself should own announcement semantics.
Those semantics suppress the region's shadow announcement to avoid duplication.
The optional `f6` behavior and `focus()` target the first visible toast, but F6 is not a standardized multi-region focus manager.
Enable F6 for at most one region per document and manually test announcement timing and focus with supported assistive technologies.

## Decorate a native scroll viewport

```html
<app-scroll-area>
	<div slot="viewport" tabindex="0" style="overflow: auto; max-block-size: 20rem">
		<div slot="content">Scrollable authored content</div>
	</div>
	<div slot="scrollbar-x"><span slot="thumb-x"></span></div>
	<div slot="scrollbar-y"><span slot="thumb-y"></span></div>
</app-scroll-area>
```

Keep exactly one direct `slot="viewport"` element as the native scroller.
Wheel, touch, keyboard, focus, scroll events, and physical `scrollTo()` or `scrollBy()` coordinates remain native to that viewport.
Read the frozen `metrics` snapshot for physical dimensions and logical inline or block offsets.

Custom rails are optional and purely presentational.
Use direct `slot="scrollbar-x"` and `slot="scrollbar-y"` rails, each with one direct matching thumb.
Keep the entire rail subtree nonfocusable.
Accepted rails are `aria-hidden`; a rail containing a potentially focusable descendant is ignored instead of hiding that descendant.
Focus the viewport for keyboard scrolling.
Pointer work revalidates the current viewport, rail, and thumb synchronously before changing scroll state.
Replacement resources release on mutation-observer reconciliation, while host disconnection releases resources synchronously.

Logical metrics, RTL normalization, and custom-thumb dragging support horizontal writing mode.
Vertical and sideways writing modes retain their native viewport behavior but do not have a custom-thumb or logical-metric guarantee.
