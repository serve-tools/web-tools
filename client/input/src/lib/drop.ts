/** Observes normalized drag sessions over a potential drop target. */
export const observeDropTarget = <TTarget extends DropTarget>(
	target: TTarget,
	handlers: DropTargetHandlers<TTarget>,
	options?: ObserveDropTargetOptions,
): DropTargetCleanup => {
	const signal = options?.signal;
	let observing = signal?.aborted !== true;
	let active = false;
	let depth = 0;

	const addDropListener = (type: DropEventType, listener: DropListener): void => {
		target.addEventListener(type, listener as EventListener);
	};

	const removeDropListener = (type: DropEventType, listener: DropListener): void => {
		target.removeEventListener(type, listener as EventListener);
	};

	const removeListeners = (): void => {
		removeDropListener("dragenter", handleDragEnter);
		removeDropListener("dragover", handleDragOver);
		removeDropListener("dragleave", handleDragLeave);
		removeDropListener("drop", handleDrop);
	};

	const start = (event: DragEvent): void => {
		if (!observing || active) return;

		active = true;

		try {
			handlers.start?.call(target, event);
		} catch (error) {
			active = false;
			depth = 0;

			throw error;
		}
	};

	const finish = (event: DragEvent, reason: Exclude<DropEndReason, "stopped">): void => {
		if (!active) return;

		active = false;
		depth = 0;

		handlers.end?.call(target, { reason }, event);
	};

	function handleDragEnter(event: DragEvent): void {
		if (!observing) return;

		++depth;
		start(event);
	}

	function handleDragOver(event: DragEvent): void {
		if (!observing) return;

		start(event);
		if (!active) return;

		handlers.over?.call(target, event);
	}

	function handleDragLeave(event: DragEvent): void {
		if (!active) return;

		if (depth > 0) --depth;
		if (depth === 0) finish(event, "leave");
	}

	function handleDrop(event: DragEvent): void {
		if (!observing) return;

		start(event);
		finish(event, "drop");
	}

	const stop = (): void => {
		if (!observing) return;

		observing = false;
		removeListeners();
		signal?.removeEventListener("abort", stop);

		if (!active) {
			depth = 0;

			return;
		}

		active = false;
		depth = 0;

		handlers.end?.call(target, { reason: "stopped" }, undefined);
	};

	if (!observing) return stop;

	signal?.addEventListener("abort", stop, { once: true });

	if (signal?.aborted) {
		stop();

		return stop;
	}

	try {
		addDropListener("dragenter", handleDragEnter);
		addDropListener("dragover", handleDragOver);
		addDropListener("dragleave", handleDragLeave);
		addDropListener("drop", handleDrop);
	} catch (error) {
		observing = false;
		removeListeners();
		signal?.removeEventListener("abort", stop);

		throw error;
	}

	return stop;
};

// #region Types

type DropEventType = "dragenter" | "dragleave" | "dragover" | "drop";
type DropListener = (event: DragEvent) => void;

/** An event target that can observe browser drag events. */
export type DropTarget = Document | Element | ShadowRoot | Window;

/** Callbacks for consecutive drag sessions over a potential drop target. */
export interface DropTargetHandlers<TTarget extends DropTarget = DropTarget> {
	/** Receives the first drag event observed in a session. */
	start?: (this: TTarget, event: DragEvent) => void;

	/**
	 * Receives every dragover event in the active session.
	 * Call preventDefault() here when the current data is acceptable and should be droppable.
	 */
	over?: (this: TTarget, event: DragEvent) => void;

	/** Receives the terminal reason and event for an active session. */
	end?: (this: TTarget, state: DropEndState, event: DragEvent | undefined) => void;
}

/** The terminal state of a drag session over a potential drop target. */
export interface DropEndState {
	/** Why the drag session ended. */
	readonly reason: DropEndReason;
}

/** Why a drag session over a potential drop target ended. */
export type DropEndReason = "leave" | "drop" | "stopped";

/** Options for observing drag sessions over a potential drop target. */
export interface ObserveDropTargetOptions {
	/** Stops observation and ends any active drag session when aborted. */
	readonly signal?: AbortSignal;
}

/** An idempotent function that stops drop-target observation and any active drag session. */
export type DropTargetCleanup = () => void;

// #endregion Types
