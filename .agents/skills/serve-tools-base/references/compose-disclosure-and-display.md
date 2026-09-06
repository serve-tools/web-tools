# Compose disclosures and display elements

Register component classes explicitly under application-chosen tag names.
The following examples assume those names have been registered.

## Keep disclosure structure native

```html
<app-accordion>
	<app-collapsible value="details">
		<h3><button>Details</button></h3>
		<section slot="panel">Detail content.</section>
	</app-collapsible>
	<app-collapsible value="notes">
		<h3><button>Notes</button></h3>
		<section slot="panel"><textarea aria-label="Notes"></textarea></section>
	</app-collapsible>
</app-accordion>
```

Import `AccordionElement` from `@serve-tools/base-components/accordion` and `CollapsibleElement` from `@serve-tools/base-components/collapsible`.
Use a direct native button or a direct button inside a direct heading, plus one direct `slot="panel"` element.
Only direct upgraded Collapsible children belong to an Accordion.
Each member needs an explicit unique `value`; an explicit empty string is valid.

Use Collapsible `open` and Accordion `values` for silent programmatic state.
Set `multiple` on the accordion to permit several expanded values.
Use cancelable `beforechange` for proposed user actions; observe `input` or `change` after accepted state commits.
Both child and group proposals bubble through the accordion.
Check `event.target === accordion` or `"values" in event.detail` before handling the complete group proposal.
Do not implement exclusivity by mutating sibling disclosures in a capture listener.

Panels remain in the DOM while hidden, preserving fields and component state.
Closing is immediate through native `hidden`; exit-animation retention and browser-find behavior are not implemented.
Every enabled trigger stays in the Tab sequence, with optional directional navigation controlled by `orientation` and `loopFocus`.
The group never rewrites a member's own `disabled` property.
Style the native trigger's `:disabled` pseudo-class for inherited fieldset disabledness.
Host `:state(disabled)` reflects only directly controlled disabled sources.

## Keep passive display semantics separate from controls

```html
<app-avatar src="/profile.jpg" alt="Profile photograph" delay="150">AL</app-avatar>
<app-meter aria-label="Storage used" min="0" max="100" value="60">60 GB</app-meter>
<app-progress aria-label="Uploading" max="100" value="40">40%</app-progress>
<app-separator orientation="vertical"></app-separator>
```

Import `AvatarElement`, `MeterElement`, `ProgressElement`, and `SeparatorElement` from their corresponding `@serve-tools/base-components/avatar`, `/meter`, `/progress`, and `/separator` entrypoints.
Change Avatar's `src`, `alt`, and `delay` on the host, not on its exposed image.
Its `image` is available for inspection and styling only.
Fallback remains author-owned text or markup; hide the entire host from accessibility when both image and fallback are decorative.

Keep meter and progress names, descriptions, and value text on their hosts.
The hosts own the accessible roles; the native visual children are `aria-hidden` and must not become second semantic controls.
Native numeric defaults apply, including a default maximum of one.
Author `max="100"` when values are percentages.
Remove Progress's `value` attribute for indeterminate progress; zero is a real determinate value.
These components are passive, do not submit form values, and do not emit input or change events.

Use the documented shadow parts for visual styles and custom states for component state.
Separator orientation supplies semantics; author CSS must render a vertical rule.
Its `decorative` mode sets a default presentation role, not an unconditional accessibility-tree exclusion when an author supplies competing ARIA or focusability.
