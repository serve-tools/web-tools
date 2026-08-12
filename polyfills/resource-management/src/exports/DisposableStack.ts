import { createDisposableStack } from "../.internals.js";
import { SuppressedError } from "./SuppressedError.js";
import { dispose } from "./Symbol/dispose.js";

const fallback = createDisposableStack(dispose, SuppressedError);
const nativeValue = Reflect.get(globalThis, "DisposableStack") as typeof fallback | undefined;

/** The native `DisposableStack` constructor when available, otherwise a module-scoped fallback. */
export const DisposableStack: typeof fallback = nativeValue || fallback;
