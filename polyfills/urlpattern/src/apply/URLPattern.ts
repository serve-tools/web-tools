import { URLPattern as value } from "@serve-tools/ponyfill-urlpattern";

globalThis.URLPattern ??
	Object.defineProperty(globalThis, "URLPattern", {
		value,
		configurable: true,
		writable: true,
	});
