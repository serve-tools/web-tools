/// <reference lib="esnext.disposable" preserve="true" />

import { SuppressedError as _SuppressedError } from "@serve-tools/ponyfill-resource-management/lib/SuppressedError";

/** The native `SuppressedError` constructor when available, otherwise a module-scoped fallback. */
export const SuppressedError = globalThis.SuppressedError ?? _SuppressedError;
