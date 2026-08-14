import {
	type Context,
	type ContextCallback,
	ContextConsumer,
	ContextProvider,
	type ContextType,
	createContext,
} from "../src/client-context.js";

interface Theme {
	name: string;
}

const key = Symbol("theme");
const themeContext = createContext<Theme>(key);
const host = document.createElement("div");

const sameKey: Context<unknown, Theme> = themeContext;
const theme: ContextType<typeof themeContext> = { name: "light" };
const callback: ContextCallback<Theme> = function (value, unsubscribe) {
	this.setAttribute("data-theme", value.name);
	unsubscribe?.();
};

const provider = new ContextProvider(host, { context: themeContext, initialValue: theme });
const consumer = new ContextConsumer(host, { context: themeContext, callback, subscribe: true });

provider.connect();
provider.setValue({ name: "dark" });
provider.disconnect();
consumer.connect();
consumer.refresh();
consumer.disconnect();

// @ts-expect-error The provider value must match its context value type.
provider.setValue("dark");

new ContextConsumer(host, {
	context: themeContext,
	// @ts-expect-error The callback value must match its context value type.
	callback: (value: string) => value,
});

void sameKey;
