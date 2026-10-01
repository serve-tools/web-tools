import {
	installCustomElementRegistry,
	supportsCustomElementRegistry,
} from "@serve-tools/ponyfill-custom-element-registry";

if (
	typeof globalThis.document !== "undefined" &&
	/\bFirefox\/\d/.test(globalThis.navigator?.userAgent ?? "") &&
	!supportsCustomElementRegistry()
) {
	installCustomElementRegistry();
}
