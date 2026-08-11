import { dispose } from "./Symbol/dispose.js";

/** A resource that can be disposed of using this package's {@link dispose} symbol. */
export interface Disposable {
	/** Disposes of resources within this object. */
	[dispose](): void;
}
