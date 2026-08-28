# Compose menus, navigation, and toolbars

Register the required classes under application-owned names.
Imports do not register tag names.

```ts
import { ContextMenuElement } from "@serve-tools/aui/context-menu";
import { MenuElement } from "@serve-tools/aui/menu";
import { MenubarElement } from "@serve-tools/aui/menubar";
import { NavigationMenuElement } from "@serve-tools/aui/navigation-menu";
import { ToolbarElement } from "@serve-tools/aui/toolbar";

customElements.define("app-menu", MenuElement);
customElements.define("app-context-menu", ContextMenuElement);
customElements.define("app-menubar", MenubarElement);
customElements.define("app-navigation-menu", NavigationMenuElement);
customElements.define("app-toolbar", ToolbarElement);
```

## Build an action menu

```html
<app-menu>
	<button slot="trigger" type="button" popovertarget="account-menu">Account</button>
	<div id="account-menu" popover role="menu">
		<a href="/profile" role="menuitem">Profile</a>
		<button type="button" role="menuitem">Sign out</button>
		<button type="button" role="menuitemcheckbox" aria-checked="false">Show offline users</button>
		<div role="group" aria-label="Density">
			<button type="button" role="menuitemradio" aria-checked="true">Comfortable</button>
			<button type="button" role="menuitemradio" aria-checked="false">Compact</button>
		</div>
	</div>
</app-menu>
```

Keep the primary trigger as a direct native `button[slot="trigger"]` and author its native `popovertarget` relationship.
Keep the popup direct and give native buttons or links explicit `menuitem`, `menuitemcheckbox`, or `menuitemradio` roles.
Menu temporarily owns popup `role="menu"` and `aria-orientation` for its current axis, then restores authored values on release.
The nearest `role="menu"` boundary owns an item, so groups may wrap items and nested popups remain independent.
Native-disabled, hidden, inert, and native hidden-input items are skipped; `aria-disabled="true"` items remain reachable but cannot activate.

Use `items` for a frozen DOM-order snapshot, `activeItem` for current roving focus, and `focusItem(indexOrIdOrElement)` to move focus without activation.
Menu defaults to vertical orientation and looping focus.
Opening with Down, Enter, or Space focuses the first item; Up focuses the last; hover opening does not move focus.
Home, End, arrow navigation, and 500 ms typeahead operate on the actual native controls.
Tab closes without trapping, while the exact next native focus destination can vary when closing top-layer state removes or restores focus.

Ordinary items close after an uncanceled click by default; checkbox and radio items stay open.
Only exact `data-close-on-click="true"` and `data-close-on-click="false"` override that default.
An empty value or any other spelling uses the default for that item role.

Checkable clicks, including programmatic `.click()`, first send cancelable, bubbling, composed Menu `beforechange` with frozen `{ item, checked, sourceEvent }` detail.
An accepted fresh transaction updates `aria-checked`, maintains radio exclusivity in the nearest `role="group"`, then sends Menu `input` and `change`.
Use `setChecked(item, checked)` or direct DOM state for a silent application update.
State, membership, role, disabledness, or close-policy changes made by a listener remain authoritative and invalidate the stale interaction.
Nested click activation is ignored until the outer transaction finishes `beforechange`, commit, `input`, and `change`.
Do not put a submission `name` on checkable menu buttons or mirror them with hidden inputs unless the product separately requires form state; AUI adds no form value.

## Nest a submenu

```html
<app-menu>
	<button slot="trigger" type="button" popovertarget="share-menu">Share</button>
	<div id="share-menu" popover role="menu">
		<button type="button" role="menuitem">Copy link</button>
		<app-menu>
			<button slot="trigger" type="button" role="menuitem" popovertarget="share-more">More</button>
			<div id="share-more" popover role="menu">
				<button type="button" role="menuitem">Embed</button>
				<button type="button" role="menuitem">Export</button>
			</div>
		</app-menu>
	</div>
</app-menu>
```

In a vertical parent, the RTL-aware inline-end arrow opens the child and moves to its first item, while inline-start closes a vertical child and restores its trigger.
In a horizontal parent, Down opens the child and the child keeps the close key for its own orientation.
Set `open-on-hover` on a Menu to allow mouse and pen opening; `delay` defaults to 100 ms and `closeDelay` defaults to zero.
Trigger-to-popup pointer grace lasts at least 300 ms regardless of `closeDelay` and uses one geometry snapshot plus temporary movement listeners.
Product CSS remains responsible for placement and usable geometry.

## Compose an application Menubar

```html
<app-menubar aria-label="Application">
	<app-menu>
		<button slot="trigger" type="button" popovertarget="file-menu">File</button>
		<div id="file-menu" popover role="menu">
			<button type="button" role="menuitem">New</button>
			<button type="button" role="menuitem">Save</button>
		</div>
	</app-menu>
	<app-menu>
		<button slot="trigger" type="button" popovertarget="edit-menu">Edit</button>
		<div id="edit-menu" popover role="menu">
			<button type="button" role="menuitem">Undo</button>
			<button type="button" role="menuitem">Redo</button>
		</div>
	</app-menu>
	<button type="button" role="menuitem">Save all</button>
</app-menubar>
```

Menubar includes direct role-bearing command items and the primary triggers of direct Menu children.
It temporarily supplies `role="menuitem"` to those Menu triggers.
Its `items`, `activeItem`, `focusItem(target)`, `openMenu`, and `close()` retain native identities.
Horizontal focus movement follows computed RTL direction; vertical orientation uses Down and Up.
In vertical orientation, the RTL-aware inline-end arrow opens a child, and inline-start from that child's popup closes it and restores its trigger.

Moving or hovering to another child trigger while a menu is open requests native opening of that sibling.
Treat the delivered native `beforetoggle` and `toggle` events as the state oracle.
Sibling switching is not atomic: native closing cannot be canceled, and canceling a new opening does not roll back the prior close.

## Add a context menu

```html
<app-context-menu>
	<section slot="trigger" tabindex="0">Project files</section>
	<div
		popover
		role="menu"
		style="position: fixed; left: var(--aui-context-menu-x); top: var(--aui-context-menu-y)"
	>
		<button type="button" role="menuitem">Rename</button>
		<button type="button" role="menuitem">Download</button>
	</div>
</app-context-menu>
```

Context Menu uses the exact direct `[slot="trigger"]` element as its context area and otherwise shares Menu item behavior.
It temporarily owns `aria-haspopup="menu"`, `aria-controls`, and `aria-expanded` on that arbitrary native context area and restores authored values when ownership ends.
Right-click writes one viewport point to `--aui-context-menu-x` and `--aui-context-menu-y` and requests native opening.
The Context Menu key and Shift+F10 use the focused target's block-end and inline-start corner.
Call `showAt(x, y, source?)` for an application-selected point, or inherited `show(source?)` when authored CSS supplies positioning.

The browser context menu is prevented only after the AUI popup opens, so a canceled opening preserves the browser default.
A primary touch held for 500 ms opens the menu and is canceled by release, cancellation, or movement beyond 10 px.
Do not claim trusted mobile-callout suppression from synthetic-event tests.
Collision and viewport clamping remain author CSS responsibilities.

## Keep site navigation natural

```html
<app-navigation-menu aria-label="Main">
	<ul slot="list">
		<li><a href="/">Home</a></li>
		<li>
			<button type="button" popovertarget="products">Products</button>
			<div id="products" popover>
				<a href="/products/a">Product A</a>
				<a href="/products/b">Product B</a>
			</div>
		</li>
	</ul>
</app-navigation-menu>
```

Navigation Menu is a labeled navigation landmark, not an application menu.
Do not add `menu` or `menuitem` roles.
Links keep navigation, list structure remains authored, and Tab follows ordinary DOM order.

The direct `[slot="list"]` is `list`.
`items` contains the first ordinary link or button belonging to each direct list row, while `disclosureTriggers` contains buttons whose authored native `popovertarget` resolves to an owned auto popover.
Use `openTrigger`, `show(trigger)`, `hide()`, and `focusItem(target)` without replacing those nodes.
Top-level arrows skip native-disabled, hidden, and inert candidates, and the applicable opening arrow opens a disclosure.
Mouse and pen hover use 50 ms `delay` and `closeDelay` defaults.

Navigation Menu supplies no portal, viewport, focus guard, collision engine, arrow geometry, or transition event.
Nested Navigation Menu hosts remain independent, and native inline disclosures may coexist without being rewritten.

## Compose a toolbar

```html
<app-toolbar aria-label="Editing">
	<button type="button">Undo</button>
	<button type="button">Redo</button>
	<a href="/help">Help</a>
	<input aria-label="Zoom" value="100%" />
	<select aria-label="Paragraph style">
		<option>Body</option>
		<option>Heading</option>
	</select>
</app-toolbar>
```

Toolbar owns one roving focus stop across direct native buttons, links, inputs, selects, and textareas.
A direct Menu contributes its primary trigger and a direct Toggle contributes its native button; nested popup items and Toggle Group members remain inside their own composites.
Use `items`, `activeItem`, `focusItem(target)`, `orientation`, and `loopFocus` to coordinate focus without activation.

Text inputs and textareas consume axis arrows while selection or caret movement remains possible; at the applicable edge, the arrow moves to the adjacent Toolbar item.
Selects keep native key handling.
Setting Toolbar `disabled` prevents pointer and programmatic click activation and temporarily supplies disabled semantics without changing values or form serialization.

## Preserve native state and lifecycle

Native auto popovers own top-layer stacking, light dismissal, Escape, source association, opening cancellation, noncancelable closing, and toggle coalescing.
Do not emulate close cancellation by reopening a popup, and do not infer a synthetic dismissal reason.
Programmatic `show()`, `showAt()`, `hide()`, `toggle()`, `focusItem()`, and `setChecked()` are explicit application operations; only click activation uses the checkable proposal transaction.
Menu and Context Menu imperative opening, closing, and toggling operations throw `InvalidStateError` when a required popup is absent, while matching user-event paths do nothing.

After a checkable commit, listener mutation during `input` suppresses stale `change` and popup-close work; mutation during `change` suppresses stale close work.

AUI releases temporary roles, ARIA, `tabindex`, button types, and popover modes when the selected node changes or the owner disconnects.
Connection-owned observers, document listeners, typeahead, hover, pointer-grace, and long-press work stop on disconnect and reacquire the current realm after adoption.
Keep trigger and popup relationships native and authored rather than adding another overlay manager, focus trap, portal, hidden form mirror, or synthetic focus target.
