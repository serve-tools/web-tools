/// <reference lib="esnext.disposable" preserve="true" />

import { createDisposableStack } from "../.internals.js";
import { SuppressedError } from "./SuppressedError.js";
import { dispose } from "./Symbol/dispose.js";

/** The native `DisposableStack` constructor when available, otherwise a module-scoped fallback. */
export const DisposableStack = globalThis.DisposableStack ?? createDisposableStack(dispose, SuppressedError);
