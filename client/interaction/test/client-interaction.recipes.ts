import { openFiles, share, writeToClipboard } from "../src/client-interaction.js";

const files = await openFiles({
	multiple: true,
	types: [{ accept: { "image/png": [".png"] } }],
});

if (files.status === "completed") {
	await share({ files: files.value, title: "Selected images" });
}

const clipboard = await writeToClipboard({ "text/plain": "Copied with @serve-tools/client-interaction" });

if (clipboard.status === "failed") console.error(clipboard.error);
