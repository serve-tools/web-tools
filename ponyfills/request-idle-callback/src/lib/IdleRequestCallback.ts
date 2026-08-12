import type { IdleDeadline } from "./IdleDeadline.js";

/** A callback invoked during an idle period or after its timeout elapses. */
export type IdleRequestCallback = (deadline: IdleDeadline) => void;
