import { Signal } from "@serve-tools/signal";

/** Stops an effect. */
export type Dispose = () => void;

/** Controls an effect whose initial run is explicitly started. */
export interface Effect {
	/** Runs the effect synchronously and starts observing its dependencies. */
	start(): void;

	/** Stops future runs. Disposal before start permanently cancels the effect. */
	dispose(): void;
}

const activeEffects = new WeakSet<object>();
const schedulerCapacity = 512;

let availableScheduler: Scheduler | undefined;
let flushScheduled = false;
let flushingSchedulers: Scheduler[] = [];
let pendingSchedulers: Scheduler[] = [];

const schedule = (scheduler: Scheduler): void => {
	if (scheduler.queued) {
		return;
	}

	scheduler.queued = true;
	pendingSchedulers.push(scheduler);

	if (!flushScheduled) {
		flushScheduled = true;

		queueMicrotask(flush);
	}
};

const flush = (): void => {
	const schedulers = pendingSchedulers;

	let errors: unknown[] | undefined;

	flushScheduled = false;
	pendingSchedulers = flushingSchedulers;
	flushingSchedulers = schedulers;
	pendingSchedulers.length = 0;

	// Snapshot and rearm every dirty scheduler before effects run so cascading invalidations enter a later batch.
	const firstScheduler = schedulers[0];
	const pending = firstScheduler.watcher.getPending();

	firstScheduler.queued = false;
	firstScheduler.watcher.watch();

	for (let index = 1; index < schedulers.length; ++index) {
		const scheduler = schedulers[index];

		scheduler.queued = false;
		pending.push(...scheduler.watcher.getPending());
		scheduler.watcher.watch();
	}

	for (const effect of pending) {
		if (!activeEffects.has(effect)) {
			continue;
		}

		try {
			effect.get();
		} catch (error) {
			(errors ??= []).push(error);
		}
	}

	flushingSchedulers.length = 0;

	if (errors?.length === 1) {
		throw errors[0];
	}

	if (errors && errors.length > 1) {
		throw new AggregateError(errors, "Multiple effects failed");
	}
};

const acquireScheduler = (): Scheduler => {
	const scheduler = availableScheduler ?? createScheduler();

	++scheduler.size;

	if (scheduler.size === schedulerCapacity) {
		availableScheduler = scheduler.next;

		scheduler.next = undefined;
	} else {
		availableScheduler = scheduler;
	}

	return scheduler;
};

const createScheduler = (): Scheduler => {
	const scheduler = { next: undefined, queued: false, size: 0 } as Scheduler;

	scheduler.watcher = new Signal.subtle.Watcher(() => schedule(scheduler));

	return scheduler;
};

const releaseScheduler = (scheduler: Scheduler): void => {
	if (scheduler.size-- === schedulerCapacity) {
		scheduler.next = availableScheduler;

		availableScheduler = scheduler;
	}
};

const startEffect = (computed: InstanceType<typeof Signal.Computed>, scheduler: Scheduler): void => {
	activeEffects.add(computed);
	scheduler.watcher.watch(computed);

	try {
		computed.get();
	} catch (error) {
		stopEffect(computed, scheduler);

		throw error;
	}
};

const stopEffect = (computed: InstanceType<typeof Signal.Computed>, scheduler: Scheduler): boolean => {
	if (activeEffects.delete(computed)) {
		scheduler.watcher.unwatch(computed);

		return true;
	}

	return false;
};

/** Creates a dormant effect controller. */
export const createEffect = (run: () => void): Effect => {
	const computed = new Signal.Computed(run);

	let startable = true;
	let scheduler: Scheduler | undefined;

	const dispose = (): void => {
		startable = false;

		if (scheduler && stopEffect(computed, scheduler)) {
			releaseScheduler(scheduler);

			scheduler = undefined;
		}
	};

	const start = (): void => {
		if (!startable) {
			return;
		}

		startable = false;

		const acquiredScheduler = acquireScheduler();

		scheduler = acquiredScheduler;

		try {
			startEffect(computed, acquiredScheduler);
		} catch (error) {
			if (scheduler === acquiredScheduler) {
				releaseScheduler(acquiredScheduler);

				scheduler = undefined;
			}

			throw error;
		}
	};

	return { start, dispose };
};

/** Runs an effect immediately and returns its disposer. */
export const effect = (run: () => void): Dispose => {
	const computed = new Signal.Computed(run);
	const scheduler = acquireScheduler();

	try {
		startEffect(computed, scheduler);
	} catch (error) {
		releaseScheduler(scheduler);

		throw error;
	}

	return () => {
		if (stopEffect(computed, scheduler)) {
			releaseScheduler(scheduler);
		}
	};
};

// #region Types

declare const queueMicrotask: (callback: () => void) => void;

interface Scheduler {
	next: Scheduler | undefined;
	queued: boolean;
	size: number;
	watcher: InstanceType<typeof Signal.subtle.Watcher>;
}

// #endregion Types
