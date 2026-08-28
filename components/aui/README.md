# @serve-tools/aui

AUI provides composable web components and a small base element for layouts backed by Signal DOM.
This workspace is under development; [the implementation plan](design/plan.md) and [behavior matrix](design/coverage.md) distinguish planned coverage from verified functionality.
No release has been authorized.
The base, Checkbox, Tabs, Dialog, Toggle, and Toggle Group are initial components, not a claim of complete Base UI coverage.

```ts
import { AUIElement } from "@serve-tools/aui/base";
import { Signal } from "@serve-tools/signal";
import { html, props, text } from "@serve-tools/signal-dom";

class CounterElement extends AUIElement {
	#count = new Signal.State(0);

	protected layout(content: DocumentFragment) {
		html(
			"button",
			props({
				type: "button",
				onclick: () => this.#count.set(this.#count.get() + 1),
			}),
			text(this.#count),
		)(content);
	}
}

customElements.define("app-counter", CounterElement);
document.body.append(document.createElement("app-counter"));
```

## Native composition

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
Property assignments and form reset are silent.
The [Checkbox contract](design/checkbox.md) records the Base UI reference and event-ordering boundary.

Style the host with `:state(checked)`, `:state(indeterminate)`, `:state(disabled)`, and `:state(readonly)`.
Use `::part(control)` for its presentational control region and `slot="indicator"` for an optional decorative indicator.
Keep the accessible label on the host or a native associated label; the indicator is hidden from accessibility semantics.
Checkbox content must be text or decorative content, not nested buttons, links, or other interactive controls.

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

## Layout and lifetime

`layout(content)` runs once on first connection, after subclass fields are initialized.
Build owned content into the supplied detached `DocumentFragment` using Signal DOM's existing functions.
The base captures the bindings created synchronously during layout, then appends the content outside capture so nested custom elements own their own lifecycle.
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
Cleanup runs in reverse registration order and continues if one cleanup throws.
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

AUI targets browser documents with native dialog/popover, ElementInternals, custom CSS states, CSS positioning, and form association.
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

To run the [interactive example](examples/index.html) from the repository root:

```shell
npm run build:dependencies --workspace @serve-tools/aui
npm run build --workspace @serve-tools/aui
npx vite components/aui/examples --host 127.0.0.1
```

## Agent Skill

The package includes consumer guidance under `skills/serve-tools-aui`.
Installing it does not automatically activate or trust the Skill.

## License

[MIT-0](LICENSE.md)
