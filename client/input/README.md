# @serve-tools/client-input

The `@serve-tools/client-input` package observes pointer and drag-and-drop input as explicit browser sessions.
It normalizes lifecycle without preventing defaults or taking propagation policy away from the application.

## Install

```shell
npm install @serve-tools/client-input
```

## Pointer observation

`observePointer` observes consecutive single-pointer interactions and keeps accepted pointers captured by the element.

```ts
import { observePointer } from "@serve-tools/client-input";

const stop = observePointer(
	thumb,
	{
		start(state, event) {
			if (!event.isPrimary || event.button !== 0) return false;

			event.preventDefault();
			thumb.classList.add("dragging");
		},
		move(state) {
			thumb.style.translate = `${state.delta.x}px ${state.delta.y}px`;
		},
		end(state) {
			thumb.classList.remove("dragging");

			if (state.reason === "up") commitDrag();
		},
	},
	{ signal },
);
```

`start` receives a zero-delta state and may return `false` to reject a pointer without capturing it or changing its event.
Once accepted, the element captures that pointer until `up`, `cancel`, `lostcapture`, explicit cleanup, or signal abortion.
Only one pointer is active per observer, and other pointer IDs are ignored until it ends.

Every state reports `origin`, current `position`, `delta`, and an unclamped `ratio` relative to the element's initial `bounds`.
The bounds remain fixed for the interaction even if layout changes.
An `end` caused by explicit cleanup or signal abortion has the reason `stopped` and no `PointerEvent`.

Pointer-event cancellation cannot suppress touch or stylus viewport panning.
Set an appropriate [`touch-action`](https://developer.mozilla.org/docs/Web/CSS/touch-action) value before direct manipulation begins.

## Drop targets

`observeDropTarget` normalizes nested drag events into consecutive sessions over an element, document, shadow root, or window.

```ts
import { observeDropTarget } from "@serve-tools/client-input/drop";

const stop = observeDropTarget(
	dropZone,
	{
		start() {
			dropZone.classList.add("drag-active");
		},
		over(event) {
			if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
		},
		end(state, event) {
			dropZone.classList.remove("drag-active");

			if (state.reason !== "drop" || event === undefined) return;

			event.preventDefault();
			importFiles(event.dataTransfer?.files);
		},
	},
	{ signal },
);
```

`start` runs once for the first `dragenter`, or for the first `dragover` or `drop` when no enter event was observed.
Moving across descendants does not create extra sessions because nested `dragenter` and `dragleave` events are balanced internally.
`over` receives every `dragover` in the active session.

The observer never prevents a default or stops propagation.
Call `preventDefault()` during an acceptable `dragover` to ask the browser to deliver `drop`.
The terminal `end` reason is `leave`, `drop`, or `stopped`.
Explicit cleanup and signal abortion use `stopped`, pass no event, remove every listener, and are idempotent.

Inspect formats from `dataTransfer.types` or `dataTransfer.items` while hovering.
Read protected payload data such as dropped files from the terminal `drop` event.

## Public API

- `observePointer` reports one accepted pointer's start, move, and terminal state with capture and geometry.
- `observeDropTarget` reports normalized drag sessions without taking ownership of drop acceptance or propagation.
- Both observers accept an external `AbortSignal` and return an idempotent cleanup function.
- Focused exports are available at `./pointer` and `./drop`.

## Compatibility

The package is an ES module for browser windows with Pointer Events or HTML Drag and Drop support as required by the chosen observer.

## Demo

The [`demo`](./demo) workspace demonstrates pointer geometry and normalized drag sessions across nested drop-target content:

[Try the demo in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/client/input/demo)

The demo directory is standalone-importable and installs the published package when it is used outside this repository.
To run it against the local workspace package instead:

```shell
npm run build --workspace @serve-tools/client-input
npm run dev --workspace @serve-tools/client-input-demo
```

## Agent Skill

This package includes `skills/serve-tools-client-input/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs unit tests and browser integration tests in Chromium, Firefox, and WebKit.

```shell
npm test --workspace @serve-tools/client-input
```

Run the opt-in Chromium benchmarks with:

```shell
npm run benchmark --workspace @serve-tools/client-input
```

## License

[MIT-0](./LICENSE.md)
