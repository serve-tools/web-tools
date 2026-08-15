/** Observes consecutive single-pointer interactions on an element. */
export const observePointer = <TElement extends Element>(
	element: TElement,
	handlers: PointerHandlers<TElement>,
	options?: ObservePointerOptions,
): PointerCleanup => {
	const signal = options?.signal;
	let observing = signal?.aborted !== true;
	let state: PointerState | undefined;

	const addPointerListener = (type: PointerEventType, listener: PointerListener): void => {
		element.addEventListener(type, listener as EventListener);
	};

	const removePointerListener = (type: PointerEventType, listener: PointerListener): void => {
		element.removeEventListener(type, listener as EventListener);
	};

	const removeSessionListeners = (): void => {
		removePointerListener("pointermove", handlePointerMove);
		removePointerListener("pointerup", handlePointerUp);
		removePointerListener("pointercancel", handlePointerCancel);
		removePointerListener("lostpointercapture", handlePointerLostCapture);
	};

	const finish = (event: PointerEvent, reason: Exclude<PointerEndReason, "stopped">): void => {
		if (state === undefined || event.pointerId !== state.pointerId) {
			return;
		}

		const endState = { ...updateState(state, event), reason };

		state = undefined;
		removeSessionListeners();

		handlers.end?.call(element, endState, event);
	};

	function handlePointerDown(event: PointerEvent): void {
		if (state !== undefined) {
			return;
		}

		const bounds = getBounds(element.getBoundingClientRect());
		const position = getPoint(event.clientX, event.clientY);
		const initialState: PointerState = {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			bounds,
			origin: position,
			position,
			delta: getPoint(0, 0),
			ratio: getPointRatio(position, bounds),
		};

		state = initialState;

		let accepted: boolean;

		try {
			accepted = handlers.start?.call(element, initialState, event) !== false;
		} catch (error) {
			if (state === initialState) {
				state = undefined;
			}

			throw error;
		}

		if (state !== initialState || !observing) {
			return;
		}

		if (!accepted) {
			state = undefined;

			return;
		}

		addPointerListener("pointermove", handlePointerMove);
		addPointerListener("pointerup", handlePointerUp);
		addPointerListener("pointercancel", handlePointerCancel);
		addPointerListener("lostpointercapture", handlePointerLostCapture);

		try {
			element.setPointerCapture(event.pointerId);
		} catch (error) {
			state = undefined;
			removeSessionListeners();

			throw error;
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		if (state === undefined || event.pointerId !== state.pointerId) {
			return;
		}

		state = updateState(state, event);

		handlers.move?.call(element, state, event);
	}

	function handlePointerUp(event: PointerEvent): void {
		finish(event, "up");
	}

	function handlePointerCancel(event: PointerEvent): void {
		finish(event, "cancel");
	}

	function handlePointerLostCapture(event: PointerEvent): void {
		finish(event, "lostcapture");
	}

	const stop = (): void => {
		if (!observing) {
			return;
		}

		observing = false;
		removePointerListener("pointerdown", handlePointerDown);
		signal?.removeEventListener("abort", stop);

		if (state === undefined) {
			return;
		}

		const endState: PointerEndState = { ...state, reason: "stopped" };
		const pointerId = state.pointerId;

		state = undefined;
		removeSessionListeners();

		try {
			if (element.hasPointerCapture(pointerId)) {
				element.releasePointerCapture(pointerId);
			}
		} finally {
			handlers.end?.call(element, endState, undefined);
		}
	};

	if (!observing) {
		return stop;
	}

	signal?.addEventListener("abort", stop, { once: true });

	if (signal?.aborted) {
		stop();

		return stop;
	}

	try {
		addPointerListener("pointerdown", handlePointerDown);
	} catch (error) {
		observing = false;
		signal?.removeEventListener("abort", stop);

		throw error;
	}

	return stop;
};

const updateState = (state: PointerState, event: PointerEvent): PointerState => {
	const position = getPoint(event.clientX, event.clientY);

	return {
		...state,
		position,
		delta: getPoint(position.x - state.origin.x, position.y - state.origin.y),
		ratio: getPointRatio(position, state.bounds),
	};
};

const getPoint = (x: number, y: number): Point => ({ x, y });

const getPointRatio = (point: Point, bounds: PointerBounds): Point =>
	getPoint(
		bounds.width === 0 ? 0 : (point.x - bounds.x) / bounds.width,
		bounds.height === 0 ? 0 : (point.y - bounds.y) / bounds.height,
	);

const getBounds = (rect: DOMRect): PointerBounds => ({
	x: rect.x,
	y: rect.y,
	width: rect.width,
	height: rect.height,
	top: rect.top,
	right: rect.right,
	bottom: rect.bottom,
	left: rect.left,
});

type PointerEventType = "lostpointercapture" | "pointercancel" | "pointerdown" | "pointermove" | "pointerup";
type PointerListener = (event: PointerEvent) => void;

/** A point in viewport coordinates or a two-dimensional difference. */
export interface Point {
	readonly x: number;
	readonly y: number;
}

/** A snapshot of the observed element's viewport bounds when an interaction started. */
export interface PointerBounds {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
	readonly left: number;
}

/** The current state of one accepted pointer interaction. */
export interface PointerState {
	/** The platform identifier for the active pointer. */
	readonly pointerId: number;

	/** The platform pointer type, including future or browser-specific values. */
	readonly pointerType: string;

	/** The observed element's bounds when this interaction started. */
	readonly bounds: PointerBounds;

	/** The pointer's viewport position when this interaction started. */
	readonly origin: Point;

	/** The pointer's current viewport position. */
	readonly position: Point;

	/** The current position minus the origin. */
	readonly delta: Point;

	/** The current position relative to the initial bounds, without clamping. */
	readonly ratio: Point;
}

/** The terminal state of one accepted pointer interaction. */
export interface PointerEndState extends PointerState {
	/** Why the interaction ended. */
	readonly reason: PointerEndReason;
}

/** Why an accepted pointer interaction ended. */
export type PointerEndReason = "up" | "cancel" | "lostcapture" | "stopped";

/** Callbacks for consecutive single-pointer interactions on an element. */
export interface PointerHandlers<TElement extends Element = Element> {
	/**
	 * Receives an initial zero-delta state and may return false to reject the interaction.
	 * Rejection leaves native defaults and event propagation unchanged.
	 */
	// biome-ignore lint/suspicious/noConfusingVoidType: void keeps ordinary named callbacks assignable while false rejects.
	start?: (this: TElement, state: PointerState, event: PointerEvent) => boolean | void;

	/** Receives each move from the accepted pointer. */
	move?: (this: TElement, state: PointerState, event: PointerEvent) => void;

	/**
	 * Receives the terminal state of an accepted interaction.
	 * The event is undefined when observation was stopped explicitly or through an AbortSignal.
	 */
	end?: (this: TElement, state: PointerEndState, event: PointerEvent | undefined) => void;
}

/** Options for observing pointer interactions. */
export interface ObservePointerOptions {
	/** Stops observation and any active interaction when aborted. */
	readonly signal?: AbortSignal;
}

/** An idempotent function that stops observation and any active interaction. */
export type PointerCleanup = () => void;
