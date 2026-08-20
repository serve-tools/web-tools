/// <reference lib="esnext.disposable" preserve="true" />

import { SuppressedError as value } from "../exports/SuppressedError.js";

globalThis.SuppressedError ?? (globalThis.SuppressedError = value as typeof globalThis.SuppressedError);
