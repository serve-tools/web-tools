/** Creates a Lit-compatible element ref whose callback may return cleanup. */
export const callbackRef = <TElement extends Element>(
	callback: callbackRef.Callback<TElement>,
	options?: callbackRef.Options,
): callbackRef.Result<TElement> => {
	const waitUntilConnected = options?.waitUntilConnected === true;

	let cleanup: callbackRef.Cleanup | undefined;
	let value: TElement | undefined;
	let animationFrame: number | undefined;
	let revision = 0;

	const attach = (): void => {
		animationFrame = undefined;

		const element = value;

		if (!element) {
			return;
		}

		if (waitUntilConnected && !element.isConnected) {
			animationFrame = requestAnimationFrame(attach);

			return;
		}

		const attachedRevision = revision;
		const nextCleanup = callback(element);

		if (attachedRevision === revision) {
			cleanup = nextCleanup;
		} else {
			nextCleanup?.();
		}
	};

	return {
		get value(): TElement | undefined {
			return value;
		},
		set value(element: TElement | undefined) {
			if (value === element) {
				return;
			}

			const nextRevision = ++revision;

			if (animationFrame !== undefined) {
				cancelAnimationFrame(animationFrame);
			}

			animationFrame = undefined;

			const previousCleanup = cleanup;

			cleanup = undefined;
			value = undefined;
			previousCleanup?.();

			if (nextRevision !== revision) {
				return;
			}

			value = element;

			if (element) {
				attach();
			}
		},
	} as callbackRef.Result<TElement>;
};

export namespace callbackRef {
	/** Sets up work for an element and optionally returns its cleanup. */
	export type Callback<TElement extends Element = Element> = (element: TElement) => Cleanup | undefined;

	/** Cleans up work created by a callback ref. */
	export type Cleanup = () => void;

	/** Configures when a callback ref invokes its callback. */
	export type Options = {
		/** Waits until the current element is connected before invoking the callback. */
		waitUntilConnected?: boolean;
	};

	/** Holds the current element for Lit's `ref()` directive. */
	export type Result<TElement extends Element = Element> = {
		readonly value?: TElement;
	};
}
