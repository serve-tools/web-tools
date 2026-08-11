import { createAsyncDisposableStack } from "../.internals.js";
import { SuppressedError } from "./SuppressedError.js";
import { asyncDispose } from "./Symbol/asyncDispose.js";
import { dispose } from "./Symbol/dispose.js";

const fallback = createAsyncDisposableStack(asyncDispose, dispose, SuppressedError);
const nativeValue = Reflect.get(globalThis, "AsyncDisposableStack") as typeof fallback | undefined;

/** The native `AsyncDisposableStack` constructor when available, otherwise a module-scoped fallback. */
export const AsyncDisposableStack: typeof fallback = nativeValue || fallback;
