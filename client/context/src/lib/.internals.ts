import type { ContextProviderAnnouncement, ContextRequest, UnknownContext } from "./context.js";

export const isElement = (value: unknown): value is Element =>
	typeof value === "object" && value !== null && "nodeType" in value && value.nodeType === 1;

const hasQualifyingFlags = (event: Event, type: string): boolean =>
	event.type === type && event.bubbles && event.composed && !event.cancelable;

export const getContextConsumer = (event: Event): Element | undefined => {
	if (!hasQualifyingFlags(event, "context-request") || !("context" in event) || !("callback" in event)) {
		return undefined;
	}

	const request = event as ContextRequest;

	if (typeof request.callback !== "function") {
		return undefined;
	}

	const consumer = request.contextTarget ?? request.composedPath()[0];

	return isElement(consumer) ? consumer : undefined;
};

export const getContextProvider = (event: Event): Element | undefined => {
	if (!hasQualifyingFlags(event, "context-provider") || !("context" in event)) {
		return undefined;
	}

	const announcement = event as ContextProviderAnnouncement;
	const provider = announcement.contextTarget ?? announcement.composedPath()[0];

	return isElement(provider) ? provider : undefined;
};

export const isUsableContext = (context: unknown): context is UnknownContext => !Number.isNaN(context);

export const reportContextError = (error: unknown): void => {
	globalThis.reportError(error);
};
