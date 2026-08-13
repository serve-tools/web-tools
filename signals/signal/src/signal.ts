// #region Internal Types

const enum _ {
	callback = "a",
	dirty = "b",
	eq = "c",
	epoch = "d",
	error = "e",
	notify = "f",
	sinks = "g",
	sources = "h",
	sourceVersions = "i",
	value = "j",
	version = "k",
	watched = "l",
	unwatched = "m",
	wrapper = "n",
	nextSource = "o",
}

interface Node {
	[_.sinks]?: AnyConsumerNode[];
	[_.unwatched]?: (() => void) | undefined;
	[_.watched]?: (() => void) | undefined;
	[_.wrapper]: any;
}

interface SignalNode<TValue = unknown> extends Node {
	[_.eq]?: ((this: any, a: any, b: any) => boolean) | undefined;
	[_.value]: TValue;
	[_.version]: number;
}

interface ConsumerNode extends Node {
	[_.dirty]: boolean;
	[_.sources]: AnySignalNode[];
	[_.nextSource]?: number;
}

interface ComputedNode<TValue = unknown> extends SignalNode<any>, ConsumerNode {
	[_.callback]: (this: any) => any;
	[_.epoch]?: number;
	[_.error]?: unknown;
	[_.sourceVersions]: number[];
	[_.value]: any;
	[_.wrapper]: Computed<TValue>;
}

interface WatcherNode extends ConsumerNode {
	[_.notify]: (this: Watcher) => void;
	[_.wrapper]: Watcher;
}

type AnySignalNode<TValue = any> = SignalNode<TValue> | ComputedNode<TValue>;
type AnyConsumerNode = ComputedNode | WatcherNode;
type AnySink = Computed<any> | Watcher;

/** Options shared by writable and computed signals. */
interface Options<T> {
	/** Returns whether two values should be treated as equal. Defaults to `Object.is`. */
	equals?: (this: T, a: any, b: any) => boolean;

	/** Runs when the signal gains its first sink. */
	[watched]?: (this: T) => void;

	/** Runs when the signal loses its last sink. */
	[unwatched]?: (this: T) => void;
}

// #region Internal State

let computing: ComputedNode | null = null;
let epoch = 0;
let notifying = false;
let notificationErrors: unknown[] | undefined;

// Private function identities double as allocation-free sentinels: err = unset, signalNode = computing, runHook = errored.
const NODE = Symbol();
const watched = Symbol("watched");
const unwatched = Symbol("unwatched");

// #region Internal Utilities

const err = (message: string): never => {
	throw new TypeError("Expected " + message);
};

const check = () => {
	if (notifying) err("unfrozen");
};

const runHook = (callback: (() => void) | undefined, node: AnySignalNode) => {
	if (callback) {
		notifying = true;
		try {
			callback.call(node[_.wrapper]);
		} finally {
			notifying = false;
		}
	}
};

const addSink = (source: AnySignalNode, sink: AnyConsumerNode) => {
	if ((source[_.sinks] ||= []).push(sink) === 1) {
		const computed = source as ComputedNode;
		if (computed[_.callback]) {
			for (const dependency of computed[_.sources]) addSink(dependency, computed);
		}
		runHook(source[_.watched], source);
	}
};

const removeSink = (source: AnySignalNode, sink: AnyConsumerNode) => {
	const sinks = source[_.sinks]!;
	const sinkIndex = sinks.indexOf(sink);
	sinks.splice(sinkIndex, 1);

	if (!sinks.length) {
		const computed = source as ComputedNode;
		if (computed[_.callback]) {
			for (const dependency of computed[_.sources]) removeSink(dependency, computed);
		}
		runHook(source[_.unwatched], source);
	}
};

const markDirty = (node: AnyConsumerNode) => {
	if (node[_.dirty]) return;

	node[_.dirty] = true;

	const watcher = node as WatcherNode;
	if (watcher[_.notify]) {
		try {
			watcher[_.notify].call(watcher[_.wrapper]);
		} catch (error) {
			(notificationErrors ||= []).push(error);
		}
	} else {
		for (const sink of node[_.sinks] || []) markDirty(sink);
	}
};

const track = (source: AnySignalNode) => {
	if (!computing) return;

	const sourceIndex = computing[_.nextSource]!++;
	const previousSource = computing[_.sources][sourceIndex];

	if (previousSource !== source) {
		if (previousSource && computing[_.sinks]?.length) {
			removeSink(previousSource, computing);
		}
		computing[_.sources][sourceIndex] = source;
		if (computing[_.sinks]?.length) addSink(source, computing);
	}
	computing[_.sourceVersions][sourceIndex] = source[_.version];
};

const finishTracking = (node: ComputedNode) => {
	while (node[_.sources].length > node[_.nextSource]!) {
		const source = node[_.sources].at(-1)!;
		if (node[_.sinks]?.length) removeSink(source, node);
		node[_.sources].pop();
		node[_.sourceVersions].pop();
	}
};

const sourcesChanged = (node: ComputedNode) => {
	for (let index = 0; index < node[_.sources].length; ++index) {
		const source = node[_.sources][index];

		if (source[_.version] !== node[_.sourceVersions][index]) {
			return true;
		}

		const computed = source as ComputedNode;

		if (computed[_.callback]) {
			updateComputed(computed);
		}

		if (source[_.version] !== node[_.sourceVersions][index]) {
			return true;
		}
	}

	return false;
};

const recompute = <T>(node: ComputedNode<T>) => {
	const previousValue = node[_.value];

	node[_.value] = signalNode;
	node[_.nextSource] = 0;

	const previousComputing = computing;

	computing = node;

	let value: T | typeof runHook = runHook;
	let error: unknown = err;
	let equal = false;

	try {
		value = node[_.callback].call(node[_.wrapper]);
		equal =
			previousValue !== err &&
			previousValue !== runHook &&
			(node[_.eq] ? node[_.eq].call(node[_.wrapper], previousValue, value) : Object.is(previousValue, value));
	} catch (caught) {
		error = caught;
	} finally {
		computing = previousComputing;

		finishTracking(node);
	}

	node[_.dirty] = false;
	node[_.epoch] = epoch;

	if (error !== err) {
		node[_.error] = error;
		node[_.value] = runHook;
		++node[_.version];
	} else {
		node[_.value] = equal ? previousValue : value;

		if (!equal) {
			++node[_.version];
		}
	}
};

const updateComputed = (node: ComputedNode) => {
	if (node[_.value] === signalNode) {
		err("no cycle");
	}

	if (!node[_.dirty] && node[_.epoch] === epoch) {
		return;
	}

	if (node[_.value] !== err && !sourcesChanged(node)) {
		node[_.dirty] = false;
		node[_.epoch] = epoch;

		return;
	}

	recompute(node);
};

const signalNode = (signal: unknown): AnySignalNode => {
	if (State.is(signal) || Computed.is(signal)) {
		return signal[NODE];
	}

	return err("signal");
};

const consumerNode = (sink: unknown): AnyConsumerNode => {
	if (Computed.is(sink) || Watcher.is(sink)) {
		return sink[NODE];
	}

	return err("signal");
};

// #region Signal Classes

/** A writable signal containing one current value. */
class State<T> {
	#brand() {}

	readonly [NODE]: SignalNode<T>;

	/** Returns whether a value is a State signal created by this runtime. */
	static is(value: unknown): value is State<unknown> {
		return typeof value === "object" && value !== null && #brand in value;
	}

	/** Creates a writable signal with an initial value and optional equality and lifecycle hooks. */
	constructor(value: T, options?: Options<State<T>>) {
		const node = {
			[_.value]: value,
			[_.version]: 0,
			[_.wrapper]: this,
		} as SignalNode<T>;
		if (options) {
			node[_.eq] = options.equals;
			node[_.unwatched] = options[unwatched];
			node[_.watched] = options[watched];
		}
		this[NODE] = node;
	}

	/** Returns the current value and records a dependency when read by a Computed signal. */
	get() {
		if (!State.is(this)) {
			return err("receiver");
		}

		check();

		const node = this[NODE];

		track(node);

		return node[_.value];
	}

	/** Replaces the current value and invalidates sinks when the equality function reports a change. */
	set(value: T) {
		if (!State.is(this)) {
			return err("receiver");
		}

		check();

		const node = this[NODE];

		if (!(node[_.eq] ? node[_.eq].call(this, node[_.value], value) : Object.is(node[_.value], value))) {
			node[_.value] = value;
			++node[_.version];

			++epoch;

			if (node[_.sinks]?.length) {
				notifying = true;

				let errors: unknown[] | undefined;

				try {
					for (const sink of node[_.sinks]) {
						markDirty(sink);
					}
				} finally {
					notifying = false;
					errors = notificationErrors;
					notificationErrors = undefined;
				}

				if (errors?.length === 1) {
					throw errors[0];
				}

				if (errors && errors.length > 1) {
					throw new AggregateError(errors);
				}
			}
		}
	}
}

/** A lazy signal derived from the signals read by its callback. */
class Computed<T> {
	#brand() {}

	readonly [NODE]: ComputedNode<T>;

	/** Returns whether a value is a Computed signal created by this runtime. */
	static is(value: unknown): value is Computed<unknown> {
		return typeof value === "object" && value !== null && #brand in value;
	}

	/** Creates a lazy computed signal with optional equality and lifecycle hooks. */
	constructor(callback: (this: Computed<T>) => T, options?: Options<Computed<T>>) {
		const node = {
			[_.callback]: callback,
			[_.dirty]: true,
			[_.epoch]: -1,
			[_.nextSource]: 0,
			[_.sources]: [],
			[_.sourceVersions]: [],
			[_.value]: err,
			[_.version]: 0,
			[_.wrapper]: this,
		} as ComputedNode<T>;

		if (options) {
			node[_.eq] = options.equals;
			node[_.unwatched] = options[unwatched];
			node[_.watched] = options[watched];
		}

		this[NODE] = node;
	}

	/** Returns the current derived value, recomputing it when a dependency changed. */
	get(): T {
		if (!Computed.is(this)) {
			return err("receiver");
		}

		check();

		const node = this[NODE];

		updateComputed(node);
		track(node);

		if (node[_.value] === runHook) {
			throw node[_.error];
		}

		return node[_.value] as T;
	}
}

/** A low-level sink that reports when one or more watched signals become dirty. */
class Watcher {
	#brand() {}

	readonly [NODE]: WatcherNode;

	/** Returns whether a value is a Watcher created by this runtime. */
	static is(value: unknown): value is Watcher {
		return typeof value === "object" && value !== null && #brand in value;
	}

	/** Creates a watcher with a notification callback. */
	constructor(notify: (this: Watcher) => void) {
		this[NODE] = {
			[_.dirty]: false,
			[_.notify]: notify,
			[_.sources]: [],
			[_.wrapper]: this,
		};
	}

	/** Adds signals to the watched set and rearms notification after pending signals are handled. */
	watch(...signals: AnySignal[]) {
		if (!Watcher.is(this)) {
			return err("receiver");
		}

		check();

		for (const signal of signals) {
			signalNode(signal);
		}

		const node = this[NODE];

		node[_.dirty] = false;

		for (const signal of signals) {
			const source = signalNode(signal);

			if (!node[_.sources].includes(source)) {
				node[_.sources].push(source);

				addSink(source, node);
			}
		}
	}

	/** Removes signals from the watched set. Passing no signals leaves the set unchanged. */
	unwatch(...signals: AnySignal[]) {
		if (!Watcher.is(this)) {
			return err("receiver");
		}

		check();

		for (const signal of signals) {
			signalNode(signal);
		}

		const node = this[NODE];

		for (const signal of signals) {
			const source = signalNode(signal);
			const sourceIndex = node[_.sources].indexOf(source);

			if (sourceIndex >= 0) {
				removeSink(source, node);

				node[_.sources].splice(sourceIndex, 1);
			}
		}
	}

	/** Returns watched computed signals that may need recomputation. */
	getPending() {
		if (!Watcher.is(this)) {
			return err("receiver");
		}

		const pending: Computed<any>[] = [];

		for (const source of this[NODE][_.sources]) {
			if ((source as ComputedNode)[_.callback] && (source as ComputedNode)[_.dirty]) {
				pending.push(source[_.wrapper]);
			}
		}

		return pending;
	}
}

// #region Signal Exports

/** Any readable signal created by this runtime. */
export type AnySignal<T = any> = State<T> | Computed<T>;

/** The instance type of a computed signal. */
export type ComputedSignal<T = any> = Computed<T>;

/** The instance type of a writable state signal. */
export type StateSignal<T = any> = State<T>;

/** Constructors, type guards, and low-level graph utilities for TC39-style Signals. */
export const Signal = {
	/** The writable signal constructor. */
	State,

	/** The lazy computed signal constructor. */
	Computed,

	/** Returns whether a value is a State signal created by this runtime. */
	isState: State.is,

	/** Returns whether a value is a Computed signal created by this runtime. */
	isComputed: Computed.is,

	/** Returns whether a value is a Watcher created by this runtime. */
	isWatcher: Watcher.is,

	/** Low-level observation, lifecycle, untracking, and graph-introspection utilities. */
	subtle: {
		/** Returns the Computed signal currently collecting dependencies, if any. */
		currentComputed() {
			return computing?.[_.wrapper] as Computed<any> | undefined;
		},

		/** Returns whether a signal currently has at least one dependent sink. */
		hasSinks(signal: AnySignal) {
			return !!signalNode(signal)[_.sinks]?.length;
		},

		/** Returns whether a Computed or Watcher currently has at least one source. */
		hasSources(signal: AnySink) {
			return !!consumerNode(signal)[_.sources].length;
		},

		/** Returns a snapshot of the Computed signals and Watchers that depend on a signal. */
		introspectSinks(signal: AnySignal) {
			return (signalNode(signal)[_.sinks]?.map((node) => node[_.wrapper]) || []) as AnySink[];
		},

		/** Returns a snapshot of the signals used by a Computed or watched by a Watcher. */
		introspectSources(signal: AnySink) {
			return consumerNode(signal)[_.sources].map((node) => node[_.wrapper]) as AnySignal[];
		},

		/** Runs a callback without recording signal dependencies. */
		untrack<T>(callback: () => T): T {
			const prev = computing;

			computing = null;

			try {
				return callback();
			} finally {
				computing = prev;
			}
		},

		/** Option key for a callback invoked when a signal gains its first sink. */
		watched,

		/** Option key for a callback invoked when a signal loses its last sink. */
		unwatched,

		/** The low-level watcher constructor. */
		Watcher,
	},
};

/** Instance aliases for constructors exposed through {@link Signal}. */
export namespace Signal {
	/** Any readable State or Computed signal. */
	export type Any<T = any> = AnySignal<T>;

	/** A lazy signal derived from other signals. */
	export type Computed<T = any> = ComputedSignal<T>;

	/** A writable signal containing one current value. */
	export type State<T = any> = StateSignal<T>;
}
