import { transferBrand } from "./.internals.js";
import type { TransferResult } from "./.types.js";

/**
 * Associates a worker-to-client result or subscription value with the objects that should be transferred.
 *
 * Request inputs instead use the `transfer` member of `RequestOptions`.
 */
export function transfer<Value>(value: Value, transfer: readonly Transferable[]): TransferResult<Value> {
	return { value, transfer, [transferBrand]: true } as unknown as TransferResult<Value>;
}
