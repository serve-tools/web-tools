/** Reports an error through the console without requiring or modifying a global `reportError`. */
export const reportError = (error: unknown): void => console.error(error);
