import { expect, test } from "vitest";

test("only exposes documented focused interaction subpaths", async () => {
	await expect(import("@serve-tools/client-interaction/clipboard")).resolves.toMatchObject({
		readFromClipboard: expect.any(Function),
		writeToClipboard: expect.any(Function),
	});
	await expect(import("@serve-tools/client-interaction/eyedropper")).resolves.toMatchObject({
		openEyeDropper: expect.any(Function),
	});
	await expect(import("@serve-tools/client-interaction/file-picker")).resolves.toMatchObject({
		openFiles: expect.any(Function),
	});
	await expect(import("@serve-tools/client-interaction/share")).resolves.toMatchObject({
		share: expect.any(Function),
	});
	const hiddenPath = "@serve-tools/client-interaction/" + ".result";

	await expect(import(hiddenPath)).rejects.toMatchObject({
		message: expect.stringContaining("is not exported"),
	});
});
