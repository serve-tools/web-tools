import type { InteractionResult, ShareData } from "../src/client-interaction.js";
import { openEyeDropper, openFiles, readFromClipboard, share, writeToClipboard } from "../src/client-interaction.js";

const shareData: ShareData = { url: "https://example.com" };
const clipboardResult: Promise<InteractionResult<void>> = writeToClipboard({
	"image/png": Promise.resolve(new Blob()),
});
const readResult: Promise<InteractionResult<ClipboardItems>> = readFromClipboard();
const shareResult: Promise<InteractionResult<void>> = share(shareData);
const colorResult: Promise<InteractionResult<string>> = openEyeDropper({ signal: new AbortController().signal });
const fileResult: Promise<InteractionResult<File[]>> = openFiles({
	multiple: true,
	types: [{ accept: { "image/png": [".png"] } }],
});

// @ts-expect-error share data must contain at least one member
share({});
// @ts-expect-error clipboard representations must be strings, blobs, or promises of either
writeToClipboard({ "text/plain": 42 });
void clipboardResult;
void readResult;
void shareResult;
void colorResult;
void fileResult;
