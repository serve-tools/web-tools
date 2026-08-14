# @serve-tools/client-interaction

The `@serve-tools/client-interaction` package starts one-shot clipboard, sharing, eyedropper, and file-selection interactions for browser clients.
It preserves transient activation where the platform permits deferred data and reports browser-mediated completion, abortion, and failure as explicit results.

```ts
import { share, writeToClipboard } from "@serve-tools/client-interaction";

button.addEventListener("click", async () => {
	const copying = writeToClipboard({
		"image/png": renderImage(),
	});

	const result = await copying;

	if (result.status === "failed") console.error(result.error);
});

shareButton.addEventListener("click", async () => {
	const result = await share({ url: location.href });

	if (result.status === "aborted") return;
	if (result.status === "failed") console.error(result.error);
});
```

## Install

```shell
npm install @serve-tools/client-interaction
```

## Interaction results

Clipboard, share, eyedropper, and file-picker operations resolve to an `InteractionResult<Value>`:

```ts
type InteractionResult<Value> =
	| { status: "completed"; value: Value }
	| { status: "aborted" }
	| { status: "failed"; error: unknown };
```

`aborted` is an expected non-completion reported by an abortable browser API.
For Web Share this can mean the user closed the share chooser or that no share targets were available.
For native file pickers it can also mean the browser declined to expose the selected entry.
Use `failed` for unsupported APIs, missing activation, permission failures, invalid data, and other errors.
The original failure value is preserved as `unknown` because JavaScript promises can reject with any value.

## Clipboard

Import clipboard helpers from the package root or the focused subpath:

```ts
import {
	isClipboardReadAvailable,
	isClipboardWriteAvailable,
	readFromClipboard,
	writeToClipboard,
} from "@serve-tools/client-interaction/clipboard";
```

`writeToClipboard` constructs `ClipboardItem` objects and calls `clipboard.write()` before returning.
Call it directly from the user gesture without awaiting other work first.
Each representation may be a string, `Blob`, or promise of either, so expensive data can resolve after the write has begun:

```ts
copyButton.addEventListener("click", () => {
	void writeToClipboard({
		"image/png": createPngBlob(),
		"text/plain": "Rendered image",
	});
});
```

MIME names are open strings because clipboard format support varies by browser and operating system.
The availability helpers report exposed methods, not permission or guaranteed operation success.

## Share

```ts
import { isShareApiAvailable, share } from "@serve-tools/client-interaction/share";

const data = { title: "Example", url: location.href };

shareButton.addEventListener("click", async () => {
	const result = await share(data);

	if (result.status === "completed") console.log("Shared");
});
```

Share data must already be resolved before the gesture.
Unlike `ClipboardItem`, the Web Share API has no deferred representation mechanism, and `navigator.share()` must consume transient activation when called.

## EyeDropper

```ts
import { isEyeDropperApiAvailable, openEyeDropper } from "@serve-tools/client-interaction/eyedropper";

const result = await openEyeDropper({ signal });

if (result.status === "completed") {
	console.log(result.value);
}
```

Closing the eyedropper or aborting its signal produces `aborted`.
The package uses local structural declarations because the API may be absent from the installed TypeScript DOM library.

## File picker

```ts
import { openFiles } from "@serve-tools/client-interaction/file-picker";

const result = await openFiles({
	multiple: true,
	types: [{ accept: { "image/png": [".png"] } }],
});
```

`openFiles` uses the native File System Access picker when it is exposed in a secure context and resolves its handles to `File` objects.
It otherwise uses a temporary file input with equivalent `multiple` and `accept` settings.
Closing either picker produces `aborted` rather than a rejected promise.

## Public API

- `InteractionResult` distinguishes completed, aborted, and failed browser interactions.
- `readFromClipboard`, `writeToClipboard`, `isClipboardReadAvailable`, and `isClipboardWriteAvailable` wrap arbitrary clipboard items.
- `share` and `isShareApiAvailable` wrap the Web Share API with explicit abortion.
- `openEyeDropper` and `isEyeDropperApiAvailable` wrap color selection.
- `openFiles` and `isNativeFilePickerAvailable` select `File` objects with a native or input-backed picker.

Focused exports are available at `./clipboard`, `./eyedropper`, `./file-picker`, and `./share`.

## Compatibility

The package is an ES module for browser windows.
Secure-context, permissions-policy, transient-activation, native UI, clipboard format, share target, and picker behavior remain controlled by the browser and operating system.

## Demo

The [`demo`](./demo) workspace exercises clipboard, sharing, file-selection, and eyedropper results from direct user gestures:

[Try the demo in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/client/interaction/demo)

The demo directory is standalone-importable and installs the published package when it is used outside this repository.
To run it against the local workspace package instead:

```shell
npm run build --workspace @serve-tools/client-interaction
npm run dev --workspace @serve-tools/client-interaction-demo
```

## Agent Skill

This package includes `skills/serve-tools-client-interaction/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs unit tests and browser integration tests in Chromium, Firefox, and WebKit.

```shell
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/client-interaction
```

Run the opt-in Chromium benchmarks with:

```shell
npm run benchmark --workspace @serve-tools/client-interaction
```

## License

[MIT-0](./LICENSE.md)
