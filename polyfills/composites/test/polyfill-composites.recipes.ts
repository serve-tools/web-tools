import "../src/polyfill-composites.js";
import { Composite } from "../src/exports/Composite.js";

/** Uses the native or installed Composite function as a stable Map key. */
export const positions = new Map([[Composite({ x: 1, y: 4 }), "book"]]);

export const item = positions.get(globalThis.Composite({ y: 4, x: 1 }));
