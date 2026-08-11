import { asyncDispose } from "./Symbol/asyncDispose.js";

/** A resource that can be disposed of asynchronously using this package's {@link asyncDispose} symbol. */
export interface AsyncDisposable {
	/** Disposes of resources within this object asynchronously. */
	[asyncDispose](): PromiseLike<void>;
}
