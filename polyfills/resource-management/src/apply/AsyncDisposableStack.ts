/// <reference lib="esnext.disposable" preserve="true" />

import "./Symbol/asyncDispose.js";
import "./Symbol/dispose.js";
import "./SuppressedError.js";
import { AsyncDisposableStack as value } from "../exports/AsyncDisposableStack.js";

globalThis.AsyncDisposableStack ?? (globalThis.AsyncDisposableStack = value as typeof globalThis.AsyncDisposableStack);
