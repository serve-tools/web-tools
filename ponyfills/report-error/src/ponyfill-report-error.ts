/** Reports an error through the console without requiring or modifying a global `reportError`. */
export const reportError = (error: unknown): void => console.error(error);

declare var console: typeof globalThis extends { onmessage: any; console: infer T }
	? T
	: { error(...data: unknown[]): void };
