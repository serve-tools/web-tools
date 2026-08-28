import type { Effect } from "@serve-tools/signal-effect";
import { createEffect } from "@serve-tools/signal-effect";
import type { Disposer } from "./dispose.js";
import { disown, own } from "./dispose.js";

/** Controls a captured set of reactive DOM bindings without changing their nodes. */
export interface BindingScope {
	/** Runs synchronous construction while capturing every reactive binding it creates; thenable results are rejected. */
	capture<Build extends () => unknown>(
		build: ReturnType<Build> extends PromiseLike<unknown> ? never : Build,
	): ReturnType<Build>;

	/** Starts and reconciles captured bindings, returning false when activation is deferred or invalidated. */
	resume(): boolean;

	/** Stops captured bindings while retaining their nodes and restart factories. */
	suspend(): void;

	/** Permanently retires every captured binding. */
	dispose(): void;
}

interface CaptureFrame {
	parent: CaptureFrame | undefined;
	records: BindingRecord[];
	scope: BindingScopeController;
}

interface CapturedBinding {
	dispose: Disposer;
	run(): void;
}

let currentCapture: CaptureFrame | undefined;

/** Creates an initially suspended lifecycle for reactive DOM bindings. */
export const createBindingScope = (): BindingScope => new BindingScopeController();

/** @internal Returns whether synchronous binding capture is active. */
export const isCapturingBindings = (): boolean => currentCapture !== undefined;

/** @internal Captures a binding in the current synchronous scope, if any. */
export const captureBinding = (owner: object | undefined, run: () => void): CapturedBinding | undefined => {
	const frame = currentCapture;

	if (!frame) {
		return;
	}

	return frame.scope.add(owner, run, frame);
};

class BindingScopeController implements BindingScope {
	readonly #records = new Set<BindingRecord>();

	#active = false;
	#captureDepth = 0;
	#disposed = false;
	#generation = 0;
	#resuming = false;
	#runningDepth = 0;
	#shouldRun = false;

	capture<Build extends () => unknown>(
		build: ReturnType<Build> extends PromiseLike<unknown> ? never : Build,
	): ReturnType<Build> {
		if (this.#disposed) {
			throw new TypeError("Cannot capture bindings in a disposed scope");
		}

		if (this.#resuming || this.#runningDepth) {
			throw new TypeError("Cannot capture bindings while this scope is running");
		}

		const parent = currentCapture;
		const frame = { parent, records: [], scope: this };

		currentCapture = frame;
		++this.#captureDepth;

		let result!: ReturnType<Build>;

		try {
			result = (build as Build)() as ReturnType<Build>;

			if (isThenable(result)) {
				throw new TypeError("Binding scope capture must complete synchronously");
			}
		} catch (error) {
			const cleanupErrors = retireRecords(frame.records);

			throwCombined(error, cleanupErrors, "Binding capture and rollback failed");
		} finally {
			--this.#captureDepth;
			currentCapture = parent;
		}

		const parentForScope = findParentFrame(parent, this);

		if (parentForScope) {
			parentForScope.records.push(...frame.records);
		} else if (this.#active) {
			try {
				this.#start(frame.records);
			} catch (error) {
				const cleanupErrors = retireRecords(frame.records);

				throwCombined(error, cleanupErrors, "Binding activation and rollback failed");
			}
		}

		return result;
	}

	resume(): boolean {
		if (this.#disposed || this.#captureDepth || this.#runningDepth || this.#resuming) {
			return false;
		}

		if (this.#active) {
			return true;
		}

		this.#shouldRun = true;
		this.#resuming = true;

		const generation = ++this.#generation;

		try {
			this.#start(this.#records);

			this.#active = this.#shouldRun && generation === this.#generation;
		} catch (error) {
			this.#shouldRun = false;
			this.#active = false;

			const cleanupErrors = stopRecords(this.#records);

			throwCombined(error, cleanupErrors, "Binding activation and rollback failed");
		} finally {
			this.#resuming = false;
		}

		return this.#active;
	}

	suspend(): void {
		if (this.#disposed) {
			return;
		}

		++this.#generation;
		this.#shouldRun = false;
		this.#active = false;

		throwCleanupErrors(stopRecords(this.#records), "Binding suspension failed");
	}

	dispose(): void {
		if (this.#disposed) {
			return;
		}

		this.#disposed = true;
		++this.#generation;
		this.#shouldRun = false;
		this.#active = false;

		throwCleanupErrors(retireRecords(this.#records), "Binding disposal failed");
	}

	add(owner: object | undefined, run: () => void, frame: CaptureFrame): CapturedBinding {
		if (this.#disposed) {
			throw new TypeError("Cannot capture bindings in a disposed scope");
		}

		const record = new BindingRecord(this, owner, run);

		this.#records.add(record);
		frame.records.push(record);

		return { dispose: record.retire, run: record.run };
	}

	delete(record: BindingRecord): void {
		this.#records.delete(record);
	}

	run(callback: () => void): void {
		++this.#runningDepth;

		try {
			callback();
		} finally {
			--this.#runningDepth;
		}
	}

	#start(records: Iterable<BindingRecord>): void {
		for (const record of records) {
			if (!this.#shouldRun) {
				break;
			}

			record.start();
		}
	}
}

class BindingRecord {
	#current: Effect | undefined;
	#retired = false;

	constructor(
		private readonly scope: BindingScopeController,
		private readonly owner: object | undefined,
		private readonly callback: () => void,
	) {
		if (owner) {
			own(owner, this.retire);
		}
	}

	readonly retire = (): void => {
		if (this.#retired) {
			return;
		}

		this.#retired = true;
		this.scope.delete(this);

		if (this.owner) {
			disown(this.owner, this.retire);
		}

		this.stop();
	};

	readonly run = (): void => this.scope.run(this.callback);

	start(): void {
		if (this.#retired || this.#current) {
			return;
		}

		const effect = createEffect(this.run);

		this.#current = effect;

		try {
			effect.start();
		} catch (error) {
			if (this.#current === effect) {
				this.#current = undefined;
			}

			effect.dispose();

			throw error;
		}
	}

	stop(): void {
		const effect = this.#current;

		if (!effect) {
			return;
		}

		this.#current = undefined;
		effect.dispose();
	}
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
	value !== null &&
	(typeof value === "object" || typeof value === "function") &&
	typeof (value as any).then === "function";

const findParentFrame = (frame: CaptureFrame | undefined, scope: BindingScopeController): CaptureFrame | undefined => {
	while (frame && frame.scope !== scope) {
		frame = frame.parent;
	}

	return frame;
};

const retireRecords = (records: Iterable<BindingRecord>): unknown[] => {
	const errors: unknown[] = [];

	for (const record of Array.from(records).reverse()) {
		try {
			record.retire();
		} catch (error) {
			errors.push(error);
		}
	}

	return errors;
};

const stopRecords = (records: Iterable<BindingRecord>): unknown[] => {
	const errors: unknown[] = [];

	for (const record of Array.from(records).reverse()) {
		try {
			record.stop();
		} catch (error) {
			errors.push(error);
		}
	}

	return errors;
};

const throwCleanupErrors = (errors: unknown[], message: string): void => {
	if (errors.length === 1) {
		throw errors[0];
	}

	if (errors.length > 1) {
		throw new AggregateError(errors, message);
	}
};

const throwCombined = (error: unknown, cleanupErrors: unknown[], message: string): never => {
	if (!cleanupErrors.length) {
		throw error;
	}

	throw new AggregateError([error, ...cleanupErrors], message);
};
