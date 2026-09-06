# Avatar, meter, progress, and separator design

Status: implemented component contracts pending package-level integration and assistive-technology review.

## Reference boundary

These components cover the observable display behavior of Base UI 1.7.0 Avatar, Meter, Progress, and Separator without reproducing their React composition model.
The pinned references are Base UI 1.7.0's `AvatarRoot`, `AvatarImage`, `AvatarFallback`, `MeterRoot`, `ProgressRoot`, and `Separator` sources and their published component documentation.
The older `@jsxtools/aui` avatar supplied the migration use case of a `src` attribute with retained fallback content.
The implementation is independent and does not copy donor or Base UI source.

Each module exports a class but does not register a custom-element name.
Applications choose registration names explicitly.

## Avatar

```ts
import { AvatarElement } from "@serve-tools/base-components/avatar";

customElements.define("app-avatar", AvatarElement);
```

```html
<app-avatar src="/people/ada.jpg" alt="Ada Lovelace" delay="150">AL</app-avatar>
```

The open shadow root retains one native `<img part="image">` and one `<span part="fallback"><slot></slot></span>`.
The image and fallback nodes retain their identity across ordinary disconnects, reconnects, and document adoption.
Only the loaded image or fallback is exposed at one time, so fallback initials cannot duplicate the loaded image's accessible name.

`src` and `alt` reflect as strings.
`delay` reflects a nonnegative finite number of milliseconds and defaults to zero.
`image` returns the retained native image for inspection and styling.
The host owns the request source; set `src` on the host rather than mutating `image.src`.
Load and error outcomes from an image whose source no longer equals the host source are ignored.
`status` reads as `idle`, `loading`, `loaded`, or `error`.
The host exposes matching custom states and a `fallback` state while fallback content is visible.

The native image owns image semantics.
An absent or empty `alt` makes the image decorative, following native `<img>` behavior.
Fallback text remains ordinary author content when it is visible.
Use `aria-hidden="true"` on the host when both the image and fallback are decorative.

Each source change starts a new request generation.
Load, error, and delay callbacks verify that generation and current source before changing visible state.
A disconnection aborts listeners and timers synchronously and clears an image request that is still pending.
Reconnection restarts a canceled pending request without rebuilding the shadow layout.
Adoption restarts the current source in the new document so relative URLs use the new document base.

Fallback is immediate when `src` is absent.
While an image source is loading or has failed, a positive `delay` waits before exposing fallback content.
Changing `delay` during that interval while connected restarts the delay from the change.
A detached element never acquires a fallback timer; a fallback already exposed after a disconnected error stays exposed.
This preserves Base UI's useful flash-prevention behavior while giving the single-element API one explicit timer owner.

## Meter

```ts
import { MeterElement } from "@serve-tools/base-components/meter";

customElements.define("app-meter", MeterElement);
```

```html
<span id="storage-label">Storage used</span>
<app-meter aria-labelledby="storage-label" aria-valuetext="60 percent" min="0" max="100" value="60">
	60 GB
</app-meter>
```

The custom-element host is the only accessibility identity and receives the `meter` role through `ElementInternals`.
Author `aria-label`, `aria-labelledby`, `aria-describedby`, and `aria-valuetext` stay on that host, so document ID references do not cross a shadow boundary.
The host is passive and does not become form-associated or keyboard-focusable.

The open shadow contains `<meter part="meter" aria-hidden="true">` followed by a default slot.
The native meter supplies numeric attribute parsing, default values, clamping, and the visual platform control, but it is hidden from accessibility to avoid a duplicate meter identity.
`meter` exposes that element for inspection and imperative styling.

`min`, `max`, `value`, `low`, `high`, and `optimum` delegate to the corresponding native numeric IDL properties and reflect their native attribute serialization on the host.
Direct host attribute changes are copied to the native oracle without sanitizing the author's source text.
ElementInternals receives the native meter's canonical minimum, maximum, and current values.

The host exposes mutually exclusive `optimum`, `suboptimal`, and `even-less-good` custom states using the native meter's canonical values and the standard low, high, and optimum regions.
These states are styling hooks only and do not make the meter interactive.

## Progress

```ts
import { ProgressElement } from "@serve-tools/base-components/progress";

customElements.define("app-progress", ProgressElement);
```

```html
<app-progress aria-label="Uploading files" max="100" value="60">60%</app-progress>
<app-progress aria-label="Connecting"></app-progress>
```

The host is the sole `progressbar` accessibility identity through `ElementInternals`.
The open shadow contains `<progress part="progress" aria-hidden="true">` and a default slot.
As with Meter, keeping author ARIA on the host preserves document-scoped label and description relationships while the native child supplies visual and numeric platform behavior without a second identity.

`max` and `value` delegate to native progress IDL and reflection.
`position` exposes the native normalized position.
`status` reads as `indeterminate`, `progressing`, or `complete`, with matching mutually exclusive custom states.
An absent `value` attribute is indeterminate and removes `aria-valuenow` from the host's internals.
Determinate zero is distinct because it has a `value` attribute, a zero position, and the `progressing` state.
Completion uses the native canonical `value === max` boundary after clamping.

Progress is passive, is not form-associated, and never dispatches input or change events.

## Separator

```ts
import { SeparatorElement } from "@serve-tools/base-components/separator";

customElements.define("app-separator", SeparatorElement);
```

```html
<app-separator></app-separator>
<app-separator orientation="vertical"></app-separator>
<app-separator decorative></app-separator>
```

The host owns the separator role and orientation through `ElementInternals`.
This keeps optional author naming on the same DOM node and supports vertical semantics without relying on shadow-root ID references.
The retained `<hr part="separator" aria-hidden="true">` supplies an ordinary rule for author styling but has no second accessibility identity.

`orientation` reads as `horizontal` or `vertical` and defaults invalid attribute values to horizontal.
The host exposes matching custom states.
`decorative` is a reflected boolean that supplies an ElementInternals default role of `none` and exposes a `decorative` custom state.
Author `role`, global ARIA attributes, or focusability can override or conflict with this default under ARIA presentation conflict resolution.
Use `decorative` only without an author role, global ARIA, or `tabindex` when the separator must be omitted from accessibility APIs.
The component preserves those author attributes rather than enforcing omission with host `aria-hidden`.
The component adds no tab index, keyboard listener, pointer listener, form behavior, or value semantics.

## Styling and lifecycle boundary

All four elements are unstyled beyond native rendering and the standard `hidden` behavior used to choose Avatar image or fallback.
Use the documented parts and host custom states rather than depending on anonymous shadow structure.
Vertical separators require author CSS because native `<hr>` has horizontal visual defaults even when the host's semantic orientation is vertical.

The shadow layout is built once on first connection through `BaseElement`.
Author light-DOM content is retained.
Meter and Progress render it through a default slot; Avatar renders it only as fallback; Separator retains but does not render children because it has no content model.
None of these components installs document listeners, observers, form callbacks, or control activation.

Automated browser tests compare Meter and Progress numeric boundaries with native elements and cover parser construction, late upgrade, disconnect, reconnect, adoption, custom states, stale Avatar outcomes, fallback delay, and semantic-owner separation in Chromium, Firefox, and WebKit.
The tests verify that visual native children are `aria-hidden` and author ARIA remains on the host.
Manual assistive-technology checks remain required before claiming complete Base UI accessibility parity.
