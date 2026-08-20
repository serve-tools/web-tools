/// <reference lib="esnext.disposable" preserve="true" />

import { createAsyncDisposableStack } from "../.internals.js";
import { SuppressedError } from "./SuppressedError.js";
import { asyncDispose } from "./Symbol/asyncDispose.js";
import { dispose } from "./Symbol/dispose.js";

/** The native `AsyncDisposableStack` constructor when available, otherwise a module-scoped fallback. */
export const AsyncDisposableStack =
	globalThis.AsyncDisposableStack ?? createAsyncDisposableStack(asyncDispose, dispose, SuppressedError);
