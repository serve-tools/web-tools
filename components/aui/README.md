# @serve-tools/aui

AUI provides composable web components and a small base element for layouts backed by Signal DOM.
This workspace is under development; [the implementation plan](design/plan.md) and [behavior matrix](design/coverage.md) distinguish planned coverage from verified functionality.
No release has been authorized.
The base, Tabs, and Dialog are initial proofs, not a claim of complete Base UI coverage.
Checkbox remains an unexported experiment while its activation and form-control contract is being decided.

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

## Agent Skill

The package includes consumer guidance under `skills/serve-tools-aui`.
Installing it does not automatically activate or trust the Skill.

## License

[MIT-0](LICENSE.md)
