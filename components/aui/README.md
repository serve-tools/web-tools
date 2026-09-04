# @serve-tools/aui

AUI provides composable web components and a small base element for layouts backed by Signal DOM.
This workspace is under development; [the implementation plan](design/plan.md) and [behavior matrix](design/coverage.md) distinguish planned coverage from verified functionality.
No release has been authorized.
The [component gallery](examples/index.html) covers all 38 tracked Base UI families and six AUI capabilities.
Six families use native HTML directly; an example is not a claim of complete Base UI behavior parity or completed manual accessibility evaluation.
The [accessibility acceptance checklist](design/accessibility.md) covers Chrome, Firefox, and Safari; its manual screen-reader results remain unverified.
The [template migration review](design/template-migration.md) records the current API, validation, measured performance, larger bundle, and remaining release decisions.

```ts
import { AUIElement } from "@serve-tools/aui/base";
import { Signal } from "@serve-tools/signal";
import { html } from "@serve-tools/aui/template";

class CounterElement extends AUIElement {
	#count = new Signal.State(0);

	protected layout() {
		return html`<button type="button" @click=${() => this.#count.set(this.#count.get() + 1)}>${this.#count}</button>`;
	}
}

customElements.define("app-counter", CounterElement);
document.body.append(document.createElement("app-counter"));
```

## Tagged templates

The opt-in `@serve-tools/aui/template` entrypoint re-exports Signal DOM's tagged-template API: inert `html` descriptions, `createFragment()`, `TemplateResult`, `TemplateFragment`, `TemplateDirective`, and `PersistentFragment`.
It does not register custom elements.
`html` only describes DOM; `createFragment(result, owner, ownerDocument?)` materializes it with that owner's bindings and returns the persistent fragment handle.

Return an `html` result from `AUIElement.layout()` for ordinary component layout, as in the quick start.
The base creates the fragment inside its binding capture, so initial values are written synchronously, removal suspends observation, and reconnection reconciles current values into the retained nodes.
Layout may still return `void` after appending imperative content to its supplied fragment.

For a standalone persistent view, retain and explicitly dispose the fragment:

```ts
import { Signal } from "@serve-tools/signal";
import { createFragment, html } from "@serve-tools/aui/template";

const owner = { count: new Signal.State(0) };
const view = createFragment(html`
  <button @click=${() => owner.count.set(owner.count.get() + 1)}>${owner.count}</button>
`, owner);
const button = view.querySelector("button")!;
document.body.append(view);

button.remove(); // Bindings remain active while detached.
document.body.append(button);
view.dispose(); // Stop effects, listeners, and directives without removing the DOM.
```

Child values, whole attributes, `.property` bindings, `@event` bindings, and synchronous element directives accept the minimal Lit-style syntax shown in the [persistent-template example](examples/template.html).
Signals update asynchronously after their initial synchronous write; plain values are written once.
The fragment handle remains the cleanup owner after its children have been appended elsewhere.
Nested `html` descriptions work in child values, including signal and iterable children.
An active nested view follows descriptor identity through iterable reordering; removing or replacing its descriptor retires that nested view promptly.
Use `PersistentFragment` when content must remain owned while parked, hidden, or restored later.
Import reusable regions from this entrypoint's `PersistentFragment` re-export, or ensure the application shares the same installed `@serve-tools/client-dom-fragment` instance.
Regions from a second package copy are not recognized as reusable regions.

This is deliberately a smaller grammar than Lit: mixed attribute strings, raw-text interpolations, comment interpolations, and nested template-content interpolations are rejected before binding starts.
Leading/trailing template whitespace is trimmed.
Only `null` removes an attribute; boolean DOM state should use a property such as `.disabled`.
Function listeners use the owner as `this`; listener objects retain their own `handleEvent` receiver and may carry native listener options.
An unchanged-options handler update does not rearm a consumed `once` listener or an aborted listener.
Use an explicit `ownerDocument` argument to create a fragment for another document; scoped custom-element registries are not selected by this entrypoint.
Standalone fragments remain active when detached or hidden until disposed.
Use connection-owned resources separately, and retain a deterministic disposal policy for permanently retired fragments.
Weak scheduling is not a guarantee that external signals cannot retain a view.
See [Own a persistent template](../../.agents/skills/serve-tools-aui/references/own-a-persistent-template.md) for cleanup, parser, and movement boundaries.

`html(owner)` and `scopedHtml(owner)` remain deprecated compatibility tags.
New code should use bare `html` with `createFragment()` or return an `html` result from `layout()`.

## Native composition

Button, Input, Fieldset, Form, Radio, and Radio Group use native HTML directly.
They intentionally have no AUI replacement class or import.
This keeps the browser's editing, keyboard, labeling, form-owner, validation, and reset behavior intact and adds no runtime for behavior HTML already provides.
The gallery labels these examples **Native HTML**, separately from custom elements.

```html
<form id="contact">
	<label>Email <input name="email" type="email" autocomplete="email" required /></label>
	<fieldset>
		<legend>Preferred contact</legend>
		<label><input type="radio" name="channel" value="email" checked required />Email</label>
		<label><input type="radio" name="channel" value="phone" />Phone</label>
	</fieldset>
	<button type="submit" name="action" value="save">Save</button>
	<button type="reset">Reset</button>
</form>
```

A radio group is defined by its shared nonempty name, form owner, and tree, not by an AUI wrapper.
Use a `fieldset` and `legend` to name the visible group, and put an external `form` attribute on each input when needed.
The selected native input is the only submitted value.
Values are strings; native radios have no read-only mode and retain the browser's own keyboard behavior.
For links, use `<a href>` rather than giving a button link semantics.
Application validation can use `setCustomValidity()`; ordinary `submit`, `reset`, `input`, and `change` remain native events.
The [native composition contract](design/native-composition.md) records these intentional API differences from Base UI.

Checkbox is a labelable, form-associated control without an authored input:

```ts
import { CheckboxElement } from "@serve-tools/aui/checkbox";

customElements.define("app-checkbox", CheckboxElement);
```

```html
<form>
	<label>
		<app-checkbox name="updates" value="yes" unchecked-value="no"></app-checkbox>
		Receive updates
	</label>
	<button type="submit">Save preferences</button>
</form>
```

The host owns focus, labels, accessible state, validation, and the form value through `ElementInternals`.
It contributes its `value` when checked, or `uncheckedValue` when unchecked and that optional value is defined.
Without those attributes, the checked value is `"on"` and an unchecked control contributes nothing.
An empty unchecked value is different from an omitted one.
External `form` IDs, native form reset, disabled fieldsets, `required`, and constraint-validation methods are supported.

`checked` is the current boolean state; `defaultChecked` and the `checked` attribute specify default state for initialization and form reset.
Like Base UI, `indeterminate` is independent presentation state and is not cleared by activation.
`readOnly` blocks interaction while retaining focusability and form participation.
As with a native checkbox carrying `readonly`, the browser excludes it from constraint validation while read-only.
Space toggles; Enter leaves checkedness alone and activates the associated form's first submit button after keydown propagation, unless prevented.
A disabled first submit button blocks that submission; the control does not look for a later enabled button.
Like Base UI 1.7.0, this Enter behavior considers submit buttons and submit inputs, not image inputs.

Every activation proposes its next state through a typed, bubbling, composed, cancelable `beforechange` event.
Its immutable `detail` contains `checked` and `sourceEvent`.
Call `event.preventDefault()` there to veto the change, including from an ancestor.
An accepted proposal updates state and form value synchronously, then emits `input` (bubbling and composed) and `change` (bubbling).
These events occur during the host's click handling; preventing a later ancestor click does not undo the change.
The handled click's default action is prevented to avoid a second activation from a wrapping label, but click propagation is preserved.
Property assignments and form reset are silent.
The [Checkbox contract](design/checkbox.md) records the Base UI reference and event-ordering boundary.

Style the host with `:state(checked)`, `:state(indeterminate)`, `:state(disabled)`, and `:state(readonly)`.
Use `::part(control)` for its presentational control region and `slot="indicator"` for an optional decorative indicator.
Keep the accessible label on the host or a native associated label; the indicator is hidden from accessibility semantics.
Checkbox content must be text or decorative content, not nested buttons, links, or other interactive controls.

Switch uses the same checked/defaultChecked, native form, optional unchecked-value, and cancelable interaction contract, with a `switch` role and no indeterminate state.
Register `SwitchElement` from `@serve-tools/aui/switch` and style its `control` part and optional `thumb` slot.

Checkbox Group coordinates direct Checkbox children without becoming a second form owner:

```ts
import { CheckboxGroupElement } from "@serve-tools/aui/checkbox-group";
import { SwitchElement } from "@serve-tools/aui/switch";

customElements.define("app-checkbox-group", CheckboxGroupElement);
customElements.define("app-switch", SwitchElement);
```

```html
<app-checkbox-group aria-label="Notification channels">
	<app-checkbox parent>All channels</app-checkbox>
	<app-checkbox name="channel" value="email" checked>Email</app-checkbox>
	<app-checkbox name="channel" value="sms">Text message</app-checkbox>
</app-checkbox-group>
<label><app-switch name="automatic" unchecked-value="off"></app-switch>Automatic updates</label>
```

Read and assign the group's `values` as a readonly string array; each ordinary member needs an explicit unique value, including an explicitly empty value when desired.
The `parent` Checkbox is a select-all control, excluded from form values and derived from the ordinary children's checkedness.
It selects or clears enabled options while preserving disabled selections, matching Base UI's parent-checkbox behavior.
A disabled unchecked option can therefore leave the parent mixed after all enabled options are selected.
Group `disabled` preserves each child's own disabled setting, and only ordinary successful children submit their individual form entries.
Children's checked attributes remain their native reset defaults.
The child proposal precedes the group's full-value `beforechange`; an accepted action emits only the source child's `input` and `change` after the entire group is coherent.
The [Checkbox Group contract](design/checkbox-group.md) describes cancellation, reset, and mixed-state cycling.

Toggle adds pressed state to an authored native button; Toggle Group coordinates direct Toggle children:

```ts
import { ToggleElement } from "@serve-tools/aui/toggle";
import { ToggleGroupElement } from "@serve-tools/aui/toggle-group";

customElements.define("app-toggle", ToggleElement);
customElements.define("app-toggle-group", ToggleGroupElement);
```

```html
<app-toggle-group multiple aria-label="Text formatting">
	<app-toggle value="bold"><button>Bold</button></app-toggle>
	<app-toggle value="italic"><button>Italic</button></app-toggle>
</app-toggle-group>
```

Each toggle's first direct native button owns its focus and activation.
The toggle supplies `type="button"`, button semantics, `aria-pressed`, and effective disabledness, preserving the author's original attributes when that button leaves the control.
Connected structural changes reconcile through the component's observer; after detached structural edits, reading `button` or reconnecting reconciles the target and releases the old one.
Use `pressed`, `disabled`, and `value` properties or attributes; property assignments are silent.
Style `:state(pressed)` on the host and native button states on the button.
Toggle is not a form control and does not submit a value.

Group `values` is a readonly array snapshot in DOM order, including when only one value is selected.
Assign an array to change selection silently.
Single selection is the default and may be empty; `multiple` permits several pressed members.
Every selectable member needs an explicit, unique `value` attribute; an explicitly empty value is valid.
Duplicate or missing member values cannot participate in selection.
Assignments reject duplicate, unknown, or ambiguous values, and single selection rejects arrays containing more than one value.
Values assigned before any children are available are retained until matching children upgrade or arrive.

Arrow keys move focus without changing selection; orientation and inherited RTL determine direction.
Home and End move to the boundaries; `loopFocus` defaults to true and `loop-focus="false"` disables wrapping.
Group `disabled` adds an interaction restriction without overwriting each toggle's own disabled property.
Detached groups retain selection and disabled coordination while connection observers and document listeners stop.

Toggle's cancelable `beforechange` carries proposed `pressed` and `sourceEvent`.
After that event finishes, a group proposes its complete `values` through a separate cancelable `beforechange`, also identifying `sourceToggle`.
Both proposals bubble and are composed; filter with `"values" in event.detail` when listening on a group because child proposals also bubble through it.
Every veto runs before group selection changes, and a listener that changes membership or selection invalidates the pending group transaction.
An accepted action commits the complete group selection before the source toggle emits one `input`/`change` pair.
Those events bubble normally, so a group listener can read `group.values` without receiving a duplicate pair from the group itself.

Tabs coordinate an authored tablist and panels without replacing their nodes:

```ts
import { TabsElement } from "@serve-tools/aui/tabs";

customElements.define("app-tabs", TabsElement);
```

```html
<app-tabs>
	<div slot="tablist" aria-label="Account">
		<button type="button" value="profile">Profile</button>
		<button type="button" value="settings">Settings</button>
	</div>
	<section slot="panel">Profile content</section>
	<section slot="panel">Settings content</section>
</app-tabs>
```

The tablist's native button children pair with the host's direct panel children by order.
Use `value`, `selectedIndex`, or `select()` to change selection without emitting user-input events.
`orientation="vertical"` changes arrow navigation; `activation="manual"` separates focus from selection until button activation.
Interactive changes emit `input` and `change`.
Automatic focus activation also emits these events, including focus moved by `focusTab()` or a native button's `focus()` method; use selection properties or `select()` for silent changes.
Author the tablist's accessible label on the tablist itself.
Panels retain their content and local state while hidden.

Dialog delegates to an authored native `<dialog>`:

```ts
import { DialogElement } from "@serve-tools/aui/dialog";

customElements.define("app-dialog", DialogElement);
```

```html
<app-dialog id="confirmation">
	<dialog aria-labelledby="confirmation-title">
		<h2 id="confirmation-title">Save changes?</h2>
		<form method="dialog">
			<button value="cancel">Cancel</button>
			<button value="save">Save</button>
		</form>
	</dialog>
</app-dialog>
```

Call `showModal()`, `show()`, and `close()` on the host; read `open`, `returnValue`, and the native `dialog` child.
The native dialog owns modality, initial and return focus, Escape behavior, validation, and `method="dialog"` submission.
The host forwards native `cancel` and `close` while connected, without bubbling; preventing the host's cancel event prevents native cancellation.
The first direct native dialog child is current; missing children produce neutral getters and `InvalidStateError` from methods that require a dialog.
Children added or replaced after parsing are supported.
Removing the host stops forwarding immediately, including a close event still waiting in the browser's task queue.
Removal and reinsertion preserve native dialog state; they do not promise to restore modality after an operation that removes it from the top layer.
Declarative trigger coordination, animated close retention, and additional dismissal policies remain planned work.

## Options, autocomplete, comboboxes, and selects

```ts
import { AutocompleteElement } from "@serve-tools/aui/autocomplete";
import { ComboboxElement } from "@serve-tools/aui/combobox";
import { OptionElement } from "@serve-tools/aui/option";
import { SelectElement } from "@serve-tools/aui/select";

customElements.define("app-option", OptionElement);
customElements.define("app-autocomplete", AutocompleteElement);
customElements.define("app-combobox", ComboboxElement);
customElements.define("app-select", SelectElement);
```

Use Autocomplete when the submitted value is editable text with suggestions:

```html
<app-autocomplete>
	<label for="airport">Airport</label>
	<input id="airport" name="airport" autocomplete="off" />
	<div popover="manual">
		<app-option value="jfk">John F. Kennedy International</app-option>
		<app-option value="lga" label="LaGuardia Airport">New York LaGuardia</app-option>
	</div>
</app-autocomplete>
```

The native input is Autocomplete's only focus, validation, reset, label, and form identity.
Filtering preserves authored option content and waits for IME composition to finish.
Accepting a suggestion writes its label to the input, so the visible label text rather than the option identity is submitted.
Disabled or read-only native inputs block acceptance.

Use Combobox when input filtering chooses explicit option values:

```html
<label for="services">Services</label>
<app-combobox id="services" name="service" multiple required>
	<input autocomplete="off" />
	<div popover="manual">
		<app-option value="">No service</app-option>
		<app-option value="basic">Basic</app-option>
		<app-option value="pro">Professional</app-option>
	</div>
</app-combobox>
```

Combobox is the sole form-associated selection identity and its native input is the sole focus and accessibility identity.
The component temporarily removes an authored input `name` to avoid duplicate submission, then restores the latest authored value when that input leaves.
Selected values submit through the host, including repeated entries in multiple mode.
Use host `setCustomValidity(message)` for application errors; the custom message persists through selection changes and reset until cleared with an empty string.

Use Select when selection opens from an authored native button:

```html
<label for="region">Region</label>
<app-select id="region" name="region">
	<button><span data-selected-label>Choose a region</span></button>
	<div popover="manual">
		<app-option value="" selected>None</app-option>
		<app-option value="americas">Americas</app-option>
		<app-option value="emea">Europe, Middle East, and Africa</app-option>
	</div>
</app-select>
```

Select keeps the native button as its focus and accessibility identity, forces it to `type="button"` while owned, and restores the author's latest type when released.
The button remains authored content; Select does not replace it with a selected option label.
Render the product's chosen summary from the current Option state:

```ts
const region = document.querySelector("app-select") as SelectElement;
const selectedLabel = region.querySelector<HTMLElement>("[data-selected-label]")!;

const renderRegion = () => {
	const selected = [...region.querySelectorAll("app-option")].find(
		(option) => (option as OptionElement).selected,
	) as OptionElement | undefined;
	selectedLabel.textContent = selected?.label ?? "Choose a region";
};

region.addEventListener("change", renderRegion);
renderRegion();
```

Call the renderer again after a silent programmatic `value`, `values`, or Option `selected` write.

Every Option needs an explicit unique string `value`; an explicit empty value is valid.
Its optional `label` supplies matching, accepted text, and accessible text while retaining authored visual content.
`selected` is silent dirty current state, while reflected `defaultSelected` and the `selected` attribute provide the current form-reset default.
Changing a default after current selection becomes dirty does not overwrite that current selection; form reset reads the latest defaults.
Reflected `value`, `disabled`, `label`, and `defaultSelected` writes synchronously reconcile the owning field, while authored text changes reconcile on its observer turn.

For Combobox and Select, frozen `values` is canonical: `[]` means no selection and `[""]` means the empty-valued option is selected.
Scalar `value` returns `""` in both cases and is only a convenience for single selection.
Programmatic `value`, `values`, and Option `selected` writes are silent.
User selection first emits cancelable `beforechange` with frozen `{ value, values, sourceEvent }`, then commits and sends host `input` and `change`.
Autocomplete instead proposes `{ value, values: [value], optionValue, sourceEvent }` and sends accepted `input` and `change` from its native input.

The direct popup uses native Popover behavior for opening, Escape, light dismissal, source association, cancellation, and toggle events.
The component supplies listbox, combobox, active-descendant, option, disabled, and selected semantics without moving DOM focus into options.
FACE labels associated with Combobox or Select focus and name the native control.
Call `refresh()` after adding, removing, or retargeting an external label; host-local control, option, label token, and popup mutations reconcile automatically, and existing label text stays live through its ID reference.
Autocomplete option text changes also refilter on the host's observer turn.

These controls do not claim inline completion, grid navigation, virtualization, generic object values, chips, portal positioning, transition APIs, configurable collator filtering, or automatic Select button rendering.
Use native `<select>` when the browser's native picker and complete native select behavior are the better product fit.
The [selection contract](design/selection.md) documents transactions, reset and restore, native popup ownership, accessibility relationships, and deliberate differences from Base UI.

## Menus, navigation, and toolbars

Register only the families the application uses:

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

Build an action menu from an authored native invoker, auto popover, and native buttons or links with explicit menu-item roles:

```html
<app-menu>
	<button slot="trigger" type="button" popovertarget="document-actions">Actions</button>
	<div id="document-actions" popover role="menu">
		<button type="button" role="menuitem">Rename</button>
		<a href="/history" role="menuitem">History</a>
		<button type="button" role="menuitemcheckbox" aria-checked="false">Show comments</button>
		<div role="group" aria-label="Access">
			<button type="button" role="menuitemradio" aria-checked="true">Private</button>
			<button type="button" role="menuitemradio" aria-checked="false">Shared</button>
		</div>
	</div>
</app-menu>
```

The author owns the trigger's native `popovertarget` relationship and popup positioning.
Menu temporarily supplies trigger ARIA, popup `role="menu"` and `aria-orientation`, roving focus, and active item semantics while preserving the actual controls.
Use `items`, `activeItem`, and `focusItem(target)` to inspect or move focus, and `show()`, `hide()`, and `toggle()` for explicit application operations.
Arrow keys, Home, End, typeahead, disabled-item behavior, nested submenus, RTL, and optional pointer hover operate on the current native items.
Native-disabled, hidden, inert, and native hidden-input controls are skipped; `aria-disabled="true"` items remain reachable but cannot activate.
Tab closes an open Menu without trapping, while the exact next sequential focus target remains native and can vary as top-layer state changes.

Ordinary items close after an uncanceled click by default, while checkbox and radio items stay open.
Set `data-close-on-click="true"` or `data-close-on-click="false"` for an exact override; any other value uses the default for that item role.
User and programmatic `.click()` activation of a checkable item proposes cancelable `beforechange` with frozen `{ item, checked, sourceEvent }` detail, then an accepted transaction updates `aria-checked` and emits Menu host `input` and `change`.
Use `setChecked(item, checked)` or direct DOM state for silent programmatic updates.
Listener-authored state or membership changes invalidate the stale proposal, and nested click activation is ignored through `beforechange`, commit, `input`, and `change`.
Checkable items remain non-form-associated buttons: do not add a submission `name`, and AUI creates no hidden form value.

Wrap several direct menus in a Menubar when the product needs one application-menu focus sequence:

```html
<app-menubar aria-label="Document commands">
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
</app-menubar>
```

Menubar exposes `items`, `activeItem`, `openMenu`, `focusItem(target)`, and `close()`.
Its default orientation is horizontal and its arrow navigation follows computed RTL direction.
In vertical orientation, Up and Down move through top-level items, inline-end opens a child, and inline-start from the child closes it and restores its trigger.
Switching between open sibling menus follows native auto-popover events; it is not an atomic transaction, and a canceled new opening does not reopen or roll back a native close.

Use Context Menu when a direct authored region should open the same Menu contract at a pointer or keyboard point:

```html
<app-context-menu>
	<section slot="trigger" tabindex="0">Project files</section>
	<div
		id="project-file-menu"
		popover
		role="menu"
		style="position: fixed; left: var(--aui-context-menu-x); top: var(--aui-context-menu-y)"
	>
		<button type="button" role="menuitem">Rename</button>
		<button type="button" role="menuitem">Download</button>
	</div>
</app-context-menu>
```

Right-click, the Context Menu key, Shift+F10, and a primary touch held within 10 pixels for 500 milliseconds set the two CSS position properties once and request native opening.
The context area temporarily receives `aria-haspopup`, `aria-controls`, and `aria-expanded`, with authored values restored when ownership ends.
Canceling native opening preserves the browser context menu.
Call `showAt(x, y, source?)` for an explicit viewport point; collision and viewport clamping remain author CSS responsibilities.

Use Navigation Menu for ordinary site navigation, where links keep natural link semantics and Tab order:

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

Navigation Menu never assigns menu or menu-item roles and does not rewrite Tab order.
It exposes the authored `list`, top-level `items`, `disclosureTriggers`, `openTrigger`, `focusItem(target)`, `show(trigger)`, and `hide()`.
Native links navigate normally, disclosure buttons retain authored `popovertarget`, and auto popovers retain Escape and outside dismissal.
Arrow movement skips native-disabled, hidden, and inert candidates without changing their authored Tab order.

Use Toolbar for one roving focus stop across direct native editing controls:

```html
<app-toolbar aria-label="Editing">
	<button type="button">Undo</button>
	<button type="button">Redo</button>
	<a href="/help">Help</a>
	<input aria-label="Zoom" value="100%" />
</app-toolbar>
```

Toolbar exposes `items`, `activeItem`, `focusItem(target)`, `orientation`, `loopFocus`, and `disabled`.
Text editors keep arrow keys while their caret can move, selects keep native key handling, and focus movement never activates a control.
Toolbar also treats a direct Menu trigger or Toggle button as one native item, without flattening nested composites.
Disabling the Toolbar prevents activation and supplies current disabled semantics without changing control values or form serialization.

Any popovers used by these families keep native opening cancellation, noncancelable closing, toggle coalescing, Escape, and light dismissal authoritative.
Menu and Context Menu imperative opening, closing, and toggling methods throw `InvalidStateError` when their required popup is absent, while matching user-event paths do nothing.
They do not create portals, hidden form controls, synthetic focus nodes, collision engines, focus traps, or transition-completion events.
The [menu composition reference](../../.agents/skills/serve-tools-aui/references/compose-menus.md) covers nested menus, hover timing, state transactions, and the deliberate boundaries in more detail.

## Field labels and validation state

```ts
import { FieldElement } from "@serve-tools/aui/field";

customElements.define("app-field", FieldElement);
```

```html
<app-field>
	<label slot="label">Account email</label>
	<input slot="control" name="email" type="email" required />
	<p slot="description">Used for account recovery.</p>
	<p slot="error">Enter a valid email address.</p>
</app-field>
```

Field coordinates one direct native or FACE control, one optional label, and any number of descriptions and errors.
A direct wrapper such as Number Field or OTP Field may instead expose a readonly `input` that identifies one usable native input in its own light DOM and document or shadow root.
Field does not search arbitrary descendants, follow external input references, or reach into a wrapper's shadow root.
Its `control`, label, ARIA relationships, state, and reset tracking then refer to the resolved native input rather than the wrapper.
It supplies owned IDs and relationships, preserving the author's existing IDREF tokens and restoring its changes when participants leave.
The actual control remains the only form and focus owner.
The host exposes `valid` (boolean or null), `invalid`, `dirty`, `touched`, `filled`, `focused`, `disabled`, and `required`, with matching custom CSS states.
`dirty` compares the current value with the association or reset baseline; `touched` records focus leaving the control.
For a FACE control with a readonly `values` array, Field snapshots the complete array before scalar `value`; `[]` is unfilled, while `[""]` is filled and changes at any position affect `dirty`.
Applications choose when to display authored error content.

Native property assignments and `setCustomValidity()` do not emit change events, so call `field.refresh()` afterward.
For a server error, set the actual control's custom validity and then refresh Field; clearing uses an empty message.
`resetState()` makes the current value pristine and untouched without changing it.
Native form reset, including forms in a shadow root or externally associated forms, establishes a new baseline after an uncanceled reset completes.
The [Field contract](design/field.md) describes the native-input adapter, custom-control facade, state tracking, and observation boundaries.

## Number fields

```ts
import { NumberFieldElement } from "@serve-tools/aui/number-field";

customElements.define("app-number-field", NumberFieldElement);
```

```html
<form>
	<app-number-field min="1" max="12" step="1">
		<button slot="decrement" aria-label="Decrease quantity">−</button>
		<input type="number" name="quantity" aria-label="Quantity" value="2" />
		<button slot="increment" aria-label="Increase quantity">+</button>
	</app-number-field>
	<button type="submit">Add to cart</button>
</form>
```

The first direct `input[type="number"]` remains the only editor, validation target, label target, and submitted form control.
The host exposes it as `input`, exposes the optional native step buttons, and temporarily supplies `type="button"` and effective disabledness to those buttons.
Use `value`, `valueAsNumber`, `min`, `max`, `step`, `disabled`, `readOnly`, and `required` on the host when coordinated writes are useful; put `name`, `form`, defaults, and custom validity on the native input.

Host value assignments, `stepUp()`, and `stepDown()` are silent, including values staged before an input is available.
An authored step-button action proposes its next value through cancelable `beforechange`, then dispatches `input` and a terminal `change` from the actual input when accepted.
Typing and other native edits keep their ordinary native input events and do not receive a synthetic precommit proposal.

## One-time-code fields

```ts
import { OTPFieldElement } from "@serve-tools/aui/otp-field";

customElements.define("app-otp-field", OTPFieldElement);
```

```html
<app-otp-field length="6">
	<input name="code" aria-label="Verification code" pattern="[0-9]{6}" />
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
	<span slot="segment"></span>
</app-otp-field>
```

OTP Field retains one direct text, password, or telephone input as the only editor and form identity.
It supplies missing one-time-code autocomplete and numeric input-mode hints, coordinates an optional exact length plus disabled, read-only, and required state, and exposes native validity methods.
Put digit validation such as `pattern` on the actual input because `inputmode="numeric"` is only a keyboard hint.

Optional `slot="segment"` elements are inert, accessibility-hidden display mirrors; editing, paste, selection, composition, password-manager behavior, and autofill remain on the single native input.
Setting host `value`, including before the input exists, is silent and does not imitate user input.

## Sliders and intervals

```ts
import { SliderElement } from "@serve-tools/aui/slider";

customElements.define("app-slider", SliderElement);
```

```html
<app-slider min="0" max="100" step="1">
	<input type="range" name="minimum" aria-label="Minimum price" value="20" />
	<input type="range" name="maximum" aria-label="Maximum price" value="80" />
</app-slider>
```

Every direct range input remains a separate focus, accessibility, pointer, keyboard, and form identity.
`inputs` and `values` are frozen snapshots in author order; assigning `values` requires one number per current input, and `value` addresses the first input.
Host `min`, `max`, `step`, `disabled`, and `orientation` coordinate native attributes, while adjacent native bounds keep interval values ordered.

Programmatic `value` and `values` writes are silent and may be staged until compatible inputs exist.
Native range edits dispatch ordinary events from the edited input; Slider does not synthesize a cancelable proposal after the browser has already changed it.
The default layout keeps native tracks separate so each remains a reliable pointer target.
Visually overlapping multiple native tracks depends on engine-specific styling and hit testing, so AUI does not claim a portable shared multi-thumb track or noninteractive replacement thumbs.
The [numeric control contract](design/numeric.md) documents stepping, constraints, CSS variables, lifecycle, and ownership in detail.

## Popovers and alerts

```ts
import { AlertDialogElement } from "@serve-tools/aui/alert-dialog";
import { PopoverElement } from "@serve-tools/aui/popover";
import { PreviewCardElement } from "@serve-tools/aui/preview-card";
import { TooltipElement } from "@serve-tools/aui/tooltip";

customElements.define("app-alert-dialog", AlertDialogElement);
customElements.define("app-popover", PopoverElement);
customElements.define("app-preview-card", PreviewCardElement);
customElements.define("app-tooltip", TooltipElement);
```

```html
<button type="button" popovertarget="settings">Settings</button>
<app-popover><div id="settings" popover>Authored settings content.</div></app-popover>
<app-tooltip delay="600">
	<button type="button">Keyboard shortcuts</button>
	<div popover="manual">Press ? to view shortcuts.</div>
</app-tooltip>
<app-preview-card>
	<a href="/people/ada">Ada Lovelace</a>
	<article popover>Authored profile preview.</article>
</app-preview-card>
```

Popover exposes `popup`, `open`, `show(source?)`, `hide()`, and `toggle(source?)` around the first direct native popover child.
Native declarative triggers target that child's ID; CSS anchor positioning controls placement.
The host forwards native `beforetoggle` and `toggle` with their source, state, cancelability, and native event coalescing.
Opening can be canceled; native closing cannot, and AUI does not attempt to reopen a canceled close.

Tooltip and Preview Card select an authored direct trigger and popup, preserve those nodes, and expose `trigger`, `delay`, and `closeDelay`.
Mouse or pen hover opens after the delay; focus opens immediately; touch hover is ignored.
Tooltip uses a manual popover, owns its description ID relationship, and never moves focus.
Its native `CloseWatcher` follows platform close-request grouping, so one Escape can close several related layers.
Canceled openings create no watcher; each accepted opening releases its watcher and listeners when it closes.
`show()` and an opening `toggle(source?)` require `CloseWatcher` support, while closing remains available without creating a watcher.
Preview Card preserves an ordinary link and uses native auto-popover dismissal, with a close delay for moving into the preview.
These components do not implement pointer-trajectory polygons, modal popovers, or a second JavaScript positioning engine.

Alert Dialog wraps a direct native `<dialog>` and exposes only `showModal()`, `close(returnValue?)`, `dialog`, `open`, and `returnValue`.
Give that dialog a real accessible name and alert description, preferably with `aria-labelledby` and `aria-describedby`, and focus the safe action with `autofocus` when appropriate.
Opening checks that name and description attributes are present, but cannot prove their resolved accessible text.
Native modality, cancellation, focus, and `method="dialog"` forms remain in charge.
The [overlay contracts](design/overlays.md) document ownership, native close-request grouping, and current behavior gaps.

## Drawers, toasts, and scroll areas

### Snap a native drawer

Drawer adds handle-only snap gestures to an authored native dialog:

```ts
import { DrawerElement } from "@serve-tools/aui/drawer";

customElements.define("app-drawer", DrawerElement);

const drawer = document.querySelector<DrawerElement>("#settings-drawer")!;
drawer.snapPoints = [0, 0.5, 1];
drawer.showModal();
drawer.snapTo(0.5);
```

```html
<app-drawer id="settings-drawer" side="right">
	<dialog aria-labelledby="settings-title">
		<div slot="handle" aria-hidden="true">Drag</div>
		<h2 id="settings-title">Settings</h2>
		<form method="dialog"><button value="done">Done</button></form>
	</dialog>
</app-drawer>
```

The one direct `<dialog>` remains the focus, modality, Escape, form, cancel, and close authority.
The one direct `slot="handle"` child inside it is the only pointer-drag target; dragging ordinary dialog content does nothing.
`side` defaults to `"bottom"`.
`snapPoints` is a frozen, sorted, duplicate-free array of finite fractions from zero through one and defaults to `[0, 1]`.
The current `snapPoint` and CSS properties `--aui-drawer-progress` and `--aui-drawer-offset` let author styles render the position.

Programmatic `snapPoint` and `snapTo()` changes are silent and do not close the native dialog, including at zero.
An accepted handle gesture first emits cancelable `beforesnap`; a nonzero snap then emits `snapchange`.
A gesture to zero uses native `requestClose()`, so the dialog's cancel path can veto it and its actual close event decides whether zero commits.
Call `close()` when programmatic code intends to close the dialog.

### Show authored toast nodes

Toast Region shows and dismisses authored toast nodes rather than copying their interactive DOM:

```ts
import { ToastRegionElement } from "@serve-tools/aui/toast-region";

customElements.define("app-toast-region", ToastRegionElement);

const notifications = document.querySelector<ToastRegionElement>("#notifications")!;
notifications.show("profile-saved");
notifications.dismiss("profile-saved", "undo");
```

```html
<app-toast-region id="notifications">
	<article id="profile-saved" slot="toast" role="status" hidden tabindex="-1">
		Profile saved.
		<button slot="dismiss">Dismiss</button>
	</article>
</app-toast-region>
```

Every direct `slot="toast"` child needs a unique nonempty ID.
`show(id, options?)` returns that same node and restarts its timer.
The region duration defaults to 5000 milliseconds; `data-aui-duration` supplies a per-toast default and `show()` options take precedence.
A duration of zero keeps the toast visible until dismissal.
Hover, focus within the toast, a hidden document, and region disconnection pause the countdown; resumption uses the remaining time.
Dismiss buttons are native `slot="dismiss"` buttons whose `type="button"` is reversibly owned while they participate.

`beforedismiss` is cancelable and identifies the toast and reason; accepted dismissal hides the retained node and emits `toastdismiss`.
An authored `aria-live` or standalone implicit live-region role such as `status` or `alert` remains authoritative and suppresses the region's shadow announcement for that toast.
`focus()` targets the first focusable descendant of the first visible toast, or the toast itself when it can receive focus.
F6 focus is opt-in with `f6`; enable it on at most one region per document to avoid order-dependent handling.
Live announcements, focus movement, and timeout suitability still require manual testing with the product's supported assistive technologies.

### Decorate a native scroll viewport

Scroll Area decorates one authored native scroll viewport:

```ts
import { ScrollAreaElement } from "@serve-tools/aui/scroll-area";

customElements.define("app-scroll-area", ScrollAreaElement);
```

```html
<app-scroll-area>
	<div slot="viewport" tabindex="0" style="overflow: auto; max-block-size: 20rem">
		<div slot="content">Scrollable authored content</div>
	</div>
	<div slot="scrollbar-x"><span slot="thumb-x"></span></div>
	<div slot="scrollbar-y"><span slot="thumb-y"></span></div>
</app-scroll-area>
```

The viewport remains the sole scroller and receives real wheel, touch, keyboard, and scroll events.
`scrollTo()` and `scrollBy()` delegate their native physical-coordinate overloads to it.
`metrics` is a frozen snapshot containing physical client and scroll dimensions plus logical `inline`, `block`, `maxInline`, and `maxBlock` offsets.
Horizontal writing mode is the supported logical-coordinate and custom-thumb scope; inline metrics and horizontal dragging normalize RTL engine differences.
Other writing modes retain native viewport scrolling without a custom-thumb guarantee.

Custom rails and thumbs are optional presentation.
Keep each rail and its entire subtree nonfocusable; accepted rails are reversibly marked `aria-hidden="true"` and expose owned thumb size and offset CSS properties.
A rail containing a link, control, editable node, or `tabindex` is ignored instead of being hidden from accessibility while focusable.
Put keyboard focus on the viewport, never on a decorative rail or thumb.
Pointer work revalidates the current viewport, rail, and thumb before changing scroll state, so a same-stack replacement rejects stale dragging.
Replacement listeners and presentation ownership release on mutation-observer reconciliation; disconnect cleanup is synchronous.

## Disclosures

Collapsible owns the behavior of an authored trigger and panel; Accordion coordinates direct Collapsible children.
Native headings and buttons stay in the document rather than being recreated in shadow roots.

```ts
import { AccordionElement } from "@serve-tools/aui/accordion";
import { CollapsibleElement } from "@serve-tools/aui/collapsible";

customElements.define("app-accordion", AccordionElement);
customElements.define("app-collapsible", CollapsibleElement);
```

```html
<app-accordion>
	<app-collapsible value="details" open>
		<h3><button>Details</button></h3>
		<section slot="panel">Retained detail content.</section>
	</app-collapsible>
	<app-collapsible value="notes">
		<h3><button>Notes</button></h3>
		<section slot="panel"><textarea aria-label="Notes"></textarea></section>
	</app-collapsible>
</app-accordion>
```

Use a direct native button, or a native button that is a direct child of a direct heading, with one direct `slot="panel"` element.
Collapsible exposes `open`, `disabled`, `value`, and readonly `button` and `panel` references.
Accordion exposes a frozen `disclosures` snapshot and a `values` array; `multiple` permits more than one open value.
Direct members require explicit unique values, including an explicitly authored empty string when desired.
Property assignments are silent; user activation proposes a cancelable `beforechange` and reports accepted state through `input` and `change`.
As with Toggle Group, the child proposal bubbles through the group before the group's complete-value proposal.
Check `event.target === accordion` or `"values" in event.detail` when handling only the group proposal.

Every enabled trigger stays in the normal tab order.
Arrow keys, Home, and End supplement native navigation without opening panels.
Closing a focused panel returns focus to its trigger before hiding it, and listener-authored state changes invalidate a stale interaction.
Panels and their contents are retained; closing currently uses native `hidden` immediately, without an exit-animation retention phase.
The [disclosure contract](design/disclosure.md) records transition differences and lifecycle boundaries.

For Toggle and Collapsible, host `:state(disabled)` describes directly controlled disabledness from the component, group, or authored button.
Use the native button's `:disabled` pseudo-class when styling effective disabledness inherited from a fieldset.
Interaction and keyboard navigation always consult the native button's eligibility.

## Display components

```ts
import { AvatarElement } from "@serve-tools/aui/avatar";
import { MeterElement } from "@serve-tools/aui/meter";
import { ProgressElement } from "@serve-tools/aui/progress";
import { SeparatorElement } from "@serve-tools/aui/separator";

customElements.define("app-avatar", AvatarElement);
customElements.define("app-meter", MeterElement);
customElements.define("app-progress", ProgressElement);
customElements.define("app-separator", SeparatorElement);
```

```html
<app-avatar src="/profile.jpg" alt="Profile photograph" delay="150">AL</app-avatar>
<span id="capacity-label">Storage used</span>
<app-meter aria-labelledby="capacity-label" min="0" max="100" value="60">60 GB</app-meter>
<app-progress aria-label="Uploading" max="100" value="40">40%</app-progress>
<app-progress aria-label="Waiting for a connection"></app-progress>
<app-separator></app-separator>
```

Avatar retains its native image and authored fallback, exposing `status` and matching custom states.
Set its `src`, `alt`, and `delay` properties; the readonly `image` reference is for inspection and styling, not for replacing the component's source.
An omitted or empty Avatar `alt` becomes an empty native image alternative, while visible fallback text remains ordinary author content.
Mark the host `aria-hidden="true"` when both the image and fallback are decorative.

Meter delegates `min`, `max`, `value`, `low`, `high`, and `optimum` parsing and clamping to a native meter.
Progress delegates `max`, `value`, and `position` to native progress semantics; remove the `value` attribute for an indeterminate state.
The hosts supply the only accessible meter and progress identities, so name and description attributes belong on the hosts.
Their native visual children are hidden from accessibility and exposed as `meter` and `progress` parts.

Separator exposes `orientation="horizontal|vertical"` and `decorative`.
Use its `separator` part for styling; vertical semantics do not automatically rotate the native horizontal rule.
Decorative mode supplies a default presentation role, which author roles, global ARIA, or focusability can override.
The [display contract](design/display.md) records numeric defaults, ownership, styling, and accessibility boundaries.

## Calendar and files

```ts
import { CalendarElement } from "@serve-tools/aui/calendar";
import { FileElement } from "@serve-tools/aui/file";

customElements.define("app-calendar", CalendarElement);
customElements.define("app-file", FileElement);
```

```html
<app-calendar
	value="2026-08-28"
	month="2026-08"
	min="2026-08-01"
	max="2026-12-31"
	locale="en-US"
	week-starts-on="0"
></app-calendar>

<form>
	<label for="attachments">Attachments</label>
	<app-file max-size="5242880">
		<input id="attachments" type="file" name="attachments" accept=".txt, .pdf" multiple />
	</app-file>
	<button type="submit">Submit</button>
	<button type="reset">Reset</button>
</form>
```

Calendar selects Gregorian plain-date strings, without creating a hidden input or form value.
`value` is `YYYY-MM-DD` or `""`; `month` is `YYYY-MM`.
`select()` and `showMonth()` are silent conveniences for those properties, and `focusDate` controls the grid's focus target.
User selection proposes a cancelable, frozen `beforechange` detail containing `value` and `sourceEvent`, followed by `input` and `change` when still current.
Arrow, Home, End, Page Up, and Page Down navigation retains the grid's real buttons; bounds, RTL, locale labels, and years `0000` through `9999` are covered by browser tests.
Style the `label`, `grid`, `weekdays`, `weekday`, `row`, `day`, `today`, `selected`, and `outside` parts.
This is an inline calendar, not a date picker or a native date-input replacement.

File retains exactly one direct native file input as its sole picker, label, focus, validity, reset, and form identity.
The readonly `input` property exposes it; `files` returns a frozen snapshot and accepts a silent array assignment through native `DataTransfer`.
`pick()` invokes the native input's click operation without inventing a promise for picker success or cancellation.
`refresh()` reconciles silent native file or validity changes, and `maxSize` optionally limits each file in bytes.
Dropped files emit a cancelable `beforechange` proposal before an accepted batch updates the actual input and emits its `input` and `change` events.
An invalid batch preserves the old files.
The authored `accept` list filters dropped and programmatically assigned batches for convenience; native picker filtering remains advisory and does not verify file contents.
Native picker edits have already occurred when input events arrive, so File validates them without pretending to provide a precommit veto.
The [Calendar and File contract](design/calendar-and-files.md) records their boundaries; automated tests do not substitute for checking an operating-system file chooser.

## Existing package integrations

Context and drag/drop use the existing `@serve-tools/client-context` and `@serve-tools/client-input` packages rather than duplicate AUI implementations.
The gallery's [integration examples](examples/integrations.ts) connect providers and consumers, refresh a consumer after a move, and give a drop observer the AUI connection's abort signal.
Their application element names are examples, not additional exports from `@serve-tools/aui`.
Declare any package you import directly as an application dependency.

Time entry remains a native `<input type="time">`, retaining browser editing, locale presentation, constraints, reset, and string form values.
Calendar and File are separate AUI components described above; an inline calendar is not the same component as a native date input.

## Layout and lifetime

`layout(content)` runs once on first connection, after subclass fields are initialized.
Return an inert `html` description for the base to materialize inside its binding capture, or append imperative content to the supplied detached `DocumentFragment` and return `void`.
The base appends materialized content outside capture so nested custom elements own their own lifecycle.
Reactive updates change existing nodes; layout does not rerun.

The default destination is the host, and existing authored children are preserved.
Override `createLayoutRoot()` to choose a shadow root:

```ts
protected createLayoutRoot() {
	return this.attachShadow({ mode: "open" });
}
```

Removal suspends active bindings synchronously, including bindings in hidden groups and closed shadow content.
Detached signal changes do not keep updating the element.
Reconnection reuses the same nodes and state and synchronously reconciles the latest values.
Ordinary application code does not need a destructor to release subscriptions after removal.
Reconciliation updates retained binding targets; it does not reconstruct a binding-owned region after an application removes or relocates its internal nodes.
Use the component's public composition points for structural changes.

Bindings created outside `layout()` are not implicitly owned by the base.
Use an explicit Signal DOM binding scope for separately managed reactive regions.
Do not call terminal `dispose()` on a component subtree as a substitute for disconnecting it.

## Connection resources

Use `connect(connection)` for document/window listeners, observers, timers, context subscriptions, and other resources that should exist only while connected.
Use `connection.signal` with APIs that accept AbortSignal and register other cleanup immediately with `addCleanup()`.

```ts
protected connect(connection: AUIElement.Connection) {
	const observer = new ResizeObserver(() => {
		this.dispatchEvent(new Event("resize"));
	});

	connection.addCleanup(() => observer.disconnect());
	observer.observe(this);
}
```

`connect()` may also return one cleanup function.
`addCleanup()` invokes late registrations immediately when the connection has already ended, including a disconnection during setup.
Cleanup uses `DisposableStack`, runs in reverse registration order, and continues if one cleanup throws.
The stack and AbortController are allocated only when requested; a signal first read after its connection ends is already aborted.
Use the supplied signal for asynchronous work, and check cancellation before applying its result.
Both layout and connection setup must return synchronously.

Override `moved(connection)` for relationships that depend on ancestors, such as context selection.
Replace the previous ancestor subscription when refreshing it, and register final cleanup with the current connection.
The base keeps bindings during a connected move and reacquires document resources after adoption.
Use the current `ownerDocument` and its `defaultView` when allocating document resources.

The native lifecycle callbacks are owned by the base.
Use the documented hooks instead of replacing them.
An initialization failure retires the failed layout; a failed connection releases its resources and may be retried by a later connection.
A reentrant remove/reinsert is retried after the current setter unwinds; repeated connectivity changes during that retry fail closed with an error instead of looping.

## Platform and package boundaries

AUI targets browser documents with native dialog/popover, ElementInternals, custom CSS states, CSS positioning, form association, and `DisposableStack`.
For an environment without explicit resource management, install `@serve-tools/polyfill-resource-management` before importing and using AUI; AUI does not mutate globals on import.
Tooltip additionally requires the native `CloseWatcher` API, verified in the current Chromium, Firefox, and WebKit test browsers.
This capability keeps tooltip dismissal in the browser's native close-request system; AUI does not provide a fallback overlay stack.
It does not install global polyfills or register element names when imported.
Applications choose their own registration names.
The package does not currently provide server-side rendering or hydration.

The base does not define property reflection or form-control policy.
Concrete components preserve the native distinction between attributes, default values, current values, and user-generated events.
An owned `<style>` node follows its shadow root across document adoption.
If sharing constructed stylesheets, cache immutable sheets per Document and adopt the current document's sheet during connection setup.
The base does not migrate arbitrary constructed stylesheets across documents.
Use host CSS properties for per-instance state; do not share a component-owned reactive stylesheet across independent lifetimes.

## Development

```shell
npm run typecheck --workspace @serve-tools/aui
npm run test:browser --workspace @serve-tools/aui
```

Browser tests run in Chromium, Firefox, and WebKit.
The [performance contract](design/performance.md) defines the comparisons required before any claim of an advantage over Base UI.

To run the [component gallery](examples/index.html) from the repository root:

```shell
npm run dev --workspace @serve-tools/aui
```

The command builds the package and its Signal, input, and context dependencies, then starts a local Vite server.
The gallery contains 44 working sections, distinguishes custom elements from native HTML compositions, and links to documented behavior limits.
Restart the command after editing package source so the examples use the rebuilt public exports.

## Agent Skill

Repository-only consumer guidance lives in [the AUI Skill](../../.agents/skills/serve-tools-aui/SKILL.md).
It is not packaged or included in the public Skill catalog while AUI is private.

## License

[MIT-0](LICENSE.md)
