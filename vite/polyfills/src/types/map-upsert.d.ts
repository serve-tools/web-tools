// Ambient global augmentation for the Map.prototype.{getOrInsert,
// getOrInsertComputed} ("Upsert") proposal, matching the runtime polyfill.
//
// Reference this file (or the `types` barrel) from your project's
// `vite-env.d.ts` to surface the methods in TypeScript:
//
//     /// <reference types="@serve-tools/vite-polyfills/types/map-upsert" />
//
// See: https://github.com/tc39/proposal-upsert

interface Map<K, V> {
	/**
	 * Returns the value associated with `key` if it exists; otherwise inserts
	 * the given `value` under `key` and returns it.
	 */
	getOrInsert(key: K, value: V): V;

	/**
	 * Returns the value associated with `key` if it exists; otherwise inserts
	 * the value returned by `compute(key)` under `key` and returns it. The
	 * `compute` callback only runs when the key is missing.
	 */
	getOrInsertComputed(key: K, compute: (key: K) => V): V;
}

interface WeakMap<K extends WeakKey, V> {
	/**
	 * Returns the value associated with `key` if it exists; otherwise inserts
	 * the given `value` under `key` and returns it.
	 */
	getOrInsert(key: K, value: V): V;

	/**
	 * Returns the value associated with `key` if it exists; otherwise inserts
	 * the value returned by `compute(key)` under `key` and returns it. The
	 * `compute` callback only runs when the key is missing.
	 */
	getOrInsertComputed(key: K, compute: (key: K) => V): V;
}
