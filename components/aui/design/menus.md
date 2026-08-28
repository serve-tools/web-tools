# Native menu and composite contracts

## Scope

Menu, Context Menu, Menubar, Navigation Menu, and Toolbar retain author-owned native controls and popup nodes.
They do not create item wrappers, portals, hidden form controls, virtual focus targets, or a document overlay manager.
Native auto popovers remain responsible for top-layer stacking, light dismissal, Escape, source association, and noncancelable closing.

The implementation uses a small private collection controller for DOM-order snapshots, roving `tabindex`, arrow movement, and Menu/Menubar typeahead.
Each public family defines its own collection boundary and activation rules.
The controller does not search for every focusable descendant or coordinate popovers.

## Menu

`MenuElement` selects a direct native `button[slot="trigger"]` as its primary trigger and the first direct authored `[popover]` as its popup.
The native `popovertarget` relationship remains authored, so the browser performs click activation and reports the real source.
External native invokers may also target the popup, although only the primary trigger participates in Menubar and hover behavior.

```html
<x-menu>
	<button slot="trigger" type="button" popovertarget="file-menu">File</button>
	<div id="file-menu" popover role="menu">
		<button type="button" role="menuitem">New</button>
		<a href="/open" role="menuitem">Open</a>
		<button type="button" role="menuitemcheckbox" aria-checked="false">Show grid</button>
		<div role="group" aria-label="Theme">
			<button type="button" role="menuitemradio" aria-checked="true">Light</button>
			<button type="button" role="menuitemradio" aria-checked="false">Dark</button>
		</div>
	</div>
</x-menu>
```

The popup is owned as an auto popover when an authored mode is incompatible and as `role="menu"` while selected.
It also owns `aria-orientation` to the Menu's current vertical or horizontal axis while selected.
The primary trigger owns `type="button"`, `aria-haspopup="menu"`, `aria-controls`, and `aria-expanded` while selected.
Those values are restored when selection ends.
The author owns `popovertarget` and popup geometry.
An `aria-disabled="true"` primary trigger remains focusable but its native click and opening-key activation are prevented.
Imperative `show(source?)` remains an explicit application operation.

Items are native buttons or links carrying an explicit `menuitem`, `menuitemcheckbox`, or `menuitemradio` role.
Only items whose nearest `role="menu"` ancestor is the current popup belong to its collection.
This permits grouping and excludes nested popup items.
Native-disabled, hidden, inert, and native hidden-input controls are skipped because the browser cannot focus them.
An `aria-disabled="true"` item remains reachable by arrow and typeahead navigation but cannot activate.

`items` is a frozen DOM-order snapshot and `activeItem` is the current roving item.
`focusItem(target)` accepts an item index, ID, or element.
`orientation` defaults to `vertical`, `loopFocus` defaults to true, and typeahead resets after 500 milliseconds.
Typeahead uses a nonempty `aria-label` when supplied and otherwise normalized authored text.

The axis arrows, Home, End, and typeahead move focus without activation.
Vertical menus use Down and Up; horizontal menus use RTL-aware Right and Left.
Down, Enter, or Space opening starts at the first item, while Up starts at the last item.
Hover opening never moves focus.
Tab closes without trapping; its exact sequential focus destination remains native and can vary when top-layer closing removes or restores focus.
Native Escape closes the applicable auto-popover branch.

Ordinary items close after an uncanceled click by default.
Checkbox and radio items remain open by default.
`data-close-on-click="true"` or `data-close-on-click="false"` overrides the item-kind default.
Matching is exact; any other string is invalid and is ignored as if the attribute were absent.

Checkbox and radio items remain `button type="button"` controls.
They do not become form-associated elements, acquire a `name`, or create a hidden form entry.
Any uncanceled click, including programmatic `click()`, dispatches cancelable, bubbling, composed `beforechange` from the MenuElement with frozen `{ item, checked, sourceEvent }` detail.
An accepted fresh transaction commits `aria-checked`, maintains radio exclusivity within the nearest `role="group"`, then dispatches `input` and `change` from the MenuElement.
`setChecked(item, checked)` and direct DOM writes are silent.

Nested menus are nested `MenuElement` hosts inside a parent popup.
Their primary trigger remains a parent menu item.
In a vertical parent menu, the inline-end arrow opens the child and inline-start closes a nested vertical child, with RTL reversal.
In a horizontal parent menu, Down opens its child while the child keeps its own orientation-specific close key.
Mouse and pen hover can be enabled with `open-on-hover`; `delay` defaults to 100 milliseconds and `close-delay` defaults to zero.
Pointer grace uses a single trigger/popup geometry snapshot and temporary pointer-move tests, never animation-frame polling or outside pointer-event mutation.
An active grace corridor remains for at least 300 milliseconds even when `closeDelay` is shorter.

## Context Menu

`ContextMenuElement` selects the exact direct element carrying `slot="trigger"` as its context area.
It shares Menu item, keyboard, checkable, submenu, and native popover behavior.
While selected, an arbitrary context area owns and later restores `aria-haspopup="menu"`, `aria-controls`, and `aria-expanded` unless it is also the primary Menu button.

```html
<x-context-menu>
	<section slot="trigger" tabindex="0">Project files</section>
	<div
		popover
		role="menu"
		style="position: fixed; left: var(--aui-context-menu-x); top: var(--aui-context-menu-y)"
	>
		<button type="button" role="menuitem">Rename</button>
	</div>
</x-context-menu>
```

Right-click records `clientX` and `clientY` once in `--aui-context-menu-x` and `--aui-context-menu-y` and associates the context area as the native source.
The browser context menu is prevented only when the AUI popup actually opens, so canceling native opening preserves the browser default.
The Context Menu key and Shift+F10 use the focused target's block-end and inline-start corner.
`showAt(x, y, source?)` exposes the same one-shot point operation.
Inherited `show(source?)` remains available for authored CSS positioning that does not need a new point.

A single-primary-touch long press opens after 500 milliseconds and is canceled by release, cancellation, or movement exceeding 10 pixels.
Automated movement and timer cases use synthetic PointerEvents and do not claim trusted mobile callout interoperability.
Context position collision and viewport clamping remain author CSS responsibilities.

## Menubar

`MenubarElement` uses a `menubar` internals role and owns one roving focus stop across direct native `role="menuitem"` buttons or links and the primary triggers of direct MenuElement children.
Direct Menu triggers are owned as `role="menuitem"` while they belong to the Menubar.
ToggleElement retains button and `aria-pressed` semantics and is therefore not a Menubar item.

```html
<x-menubar aria-label="Application">
	<x-menu>...File trigger and popup...</x-menu>
	<x-menu>...Edit trigger and popup...</x-menu>
	<button type="button" role="menuitem">Save</button>
</x-menubar>
```

`items`, `activeItem`, `focusItem(target)`, `openMenu`, and `close()` expose current native identities.
The default orientation is horizontal and focus loops by default.
Horizontal arrows follow computed RTL direction; Home, End, and typeahead are supported.
In a vertical Menubar, Up and Down move between top-level items before child Menu handling, the RTL-aware inline-end arrow opens a child, and inline-start from that child's popup closes it and restores the trigger.
An `aria-disabled="true"` direct command stays in the roving collection but its click activation is prevented.

In a horizontal Menubar, Down and Up opening are supplied by each child Menu.
When one child menu is open, moving or hovering to another child trigger requests native opening of that sibling.
Native auto-popover behavior closes the previous branch.
The switch is not described as atomic: native closing cannot be canceled, a canceled new opening is not rolled back, and delivered `beforetoggle` and `toggle` events remain the state oracle.

## Navigation Menu

`NavigationMenuElement` is a navigation landmark whose author supplies an accessible label.
It selects a direct authored `[slot="list"]` and leaves its list, list-item, button, link, and popup structure in place.
It never assigns `menu` or `menuitem` roles and never changes ordinary Tab order.

```html
<x-navigation-menu aria-label="Main">
	<ul slot="list">
		<li><a href="/">Home</a></li>
		<li>
			<button type="button" popovertarget="products">Products</button>
			<div id="products" popover>
				<a href="/products/a">Product A</a>
			</div>
		</li>
	</ul>
</x-navigation-menu>
```

Top-level `items` are the first ordinary link or button belonging to each direct list row.
`disclosureTriggers` contains descendant native buttons whose authored `popovertarget` resolves to an auto popover inside this NavigationMenu.
Nested NavigationMenu hosts are independent.
`openTrigger`, `show(trigger)`, `hide()`, and `focusItem(target)` preserve those identities.
An `aria-disabled="true"` disclosure remains in authored Tab and arrow order, but native click and `show(trigger)` opening are prevented.

Top-level arrow navigation moves focus without changing any `tabindex` and skips native-disabled, hidden, and inert candidates.
Down opens a horizontal disclosure and the RTL-aware inline-end arrow opens a vertical disclosure.
Mouse and pen hover use `delay` and `closeDelay`, both defaulting to 50 milliseconds, with bounded trigger/popup occupancy grace.
Tab follows authored DOM order into content, link activation remains native, and Escape/outside dismissal remains the auto-popover behavior.

There is no portal, shared viewport, content movement, focus guard, size observer, collision engine, arrow geometry, or transition-completion event.
Native `<details>` and other inline disclosures may coexist as authored content but are not rewritten by the component.

## Toolbar

`ToolbarElement` uses a `toolbar` internals role and owns one roving focus stop across direct native buttons, links, inputs, selects, and textareas.
It also accepts the primary trigger proxy of a direct MenuElement and the button proxy of a direct ToggleElement.
Popup descendants are never collected.

```html
<x-toolbar aria-label="Editing">
	<button type="button">Undo</button>
	<a href="/help">Help</a>
	<input aria-label="Zoom" value="100%">
	<x-menu>...toolbar menu trigger and popup...</x-menu>
</x-toolbar>
```

`items`, `activeItem`, and `focusItem(target)` expose actual native focus nodes.
The default orientation is horizontal and arrow navigation loops by default.
Home, End, RTL, native-disabled skipping, dynamic replacement, and authored `tabindex` restoration are supported.

Text inputs and textareas retain axis arrows while Shift is held, text is selected, or the collapsed caret can still move in that direction.
At the applicable caret edge, an axis arrow moves to the adjacent toolbar item.
Selects keep their native key handling.
Focus movement never activates a control.

An `aria-disabled="true"` item stays focusable but activation is prevented.
The host `disabled` state temporarily owns `aria-disabled="true"` across its current entries and prevents pointer and programmatic click activation without changing values or form serialization.

ToggleGroupElement remains an independent nested composite and retains its own single Tab stop and arrow behavior.
Toolbar does not flatten its buttons or compete for their `tabindex` ownership.

## Transactions and lifecycle

Every checkable user transaction captures a revision, item order, roles, checked state, disabled state, and close policy before dispatching its proposal.
After listeners finish, any explicit state or membership mutation remains, while the stale interaction aborts.
Reentrant user activation is ignored through proposal, commit, `input`, and `change`.
After commit, a mutation during `input` suppresses stale `change` and close work, while a mutation during `change` suppresses stale close work.

Native popover events retain their platform contract.
Cancelable opening may be vetoed, closing `beforetoggle` is not cancelable, no component reopens a canceled native close, and user-agent toggle coalescing is honored.
The components do not invent Escape, outside-click, focus-out, or item-selection reasons.

Observers, document listeners, pointer-grace sessions, typeahead timers, hover timers, and long-press timers belong to one connection interval and use the current owner realm.
Replacement releases old attribute ownership, invalidates stale delayed work, and closes an open popup before a new source relationship is used.
Initial synchronization preserves a correctly modeled already-open native popup during late custom-element upgrade.
Adoption disconnects the old realm and reacquires constructors, listeners, observers, and timers from the new realm.
