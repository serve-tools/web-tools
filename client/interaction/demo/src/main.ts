/// <reference lib="dom" />

import {
	isClipboardWriteAvailable,
	isEyeDropperApiAvailable,
	isNativeFilePickerAvailable,
	isShareApiAvailable,
	openEyeDropper,
	openFiles,
	share,
	writeToClipboard,
} from "@serve-tools/client-interaction";

const query = <ElementType extends Element>(selector: string): ElementType => {
	const element = document.querySelector<ElementType>(selector);

	if (!element) throw new Error(`Missing demo element: ${selector}`);

	return element;
};

const output = query<HTMLOutputElement>("output");
const support = (selector: string, available: boolean, fallback = "Fallback available"): void => {
	query(selector).textContent = available ? "Available here" : fallback;
};

support("#copy-support", isClipboardWriteAvailable(), "Unavailable here");
support("#share-support", isShareApiAvailable(), "Unavailable here");
support("#files-support", isNativeFilePickerAvailable());
support("#color-support", isEyeDropperApiAvailable(), "Unavailable here");

const report = (label: string, result: { status: string; error?: unknown }, detail?: string): void => {
	const error = result.status === "failed" ? ` — ${String(result.error)}` : "";

	output.value = `${label}: ${result.status}${detail ? ` — ${detail}` : ""}${error}`;
	output.dataset.status = result.status;
};

query("#copy").addEventListener("click", async () => {
	const result = await writeToClipboard({
		"text/plain": `Copied from @serve-tools/client-interaction at ${new Date().toLocaleTimeString()}`,
	});

	report("Clipboard", result);
});

query("#share").addEventListener("click", async () => {
	const result = await share({
		title: "@serve-tools/client-interaction",
		text: "Explicit outcomes for browser-mediated interactions.",
		url: location.href,
	});

	report("Share", result);
});

query("#files").addEventListener("click", async () => {
	const result = await openFiles({ multiple: true });
	const detail = result.status === "completed" ? result.value.map((file) => file.name).join(", ") : undefined;

	report("Files", result, detail);
});

query("#color").addEventListener("click", async () => {
	const result = await openEyeDropper();

	if (result.status === "completed") {
		document.documentElement.style.setProperty("--picked-color", result.value);
	}

	report("EyeDropper", result, result.status === "completed" ? result.value : undefined);
});
