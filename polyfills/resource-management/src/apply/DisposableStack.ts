/// <reference lib="esnext.disposable" preserve="true" />

import "./Symbol/dispose.js";
import "./SuppressedError.js";
import { DisposableStack as value } from "../exports/DisposableStack.js";

globalThis.DisposableStack ?? (globalThis.DisposableStack = value as typeof globalThis.DisposableStack);
