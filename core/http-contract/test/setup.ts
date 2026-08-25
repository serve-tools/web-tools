if (typeof globalThis.URLPattern !== "function") {
	await import("@serve-tools/polyfill-urlpattern");
}

export {};
