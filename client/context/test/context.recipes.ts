import { ContextConsumer, ContextProvider, createContext } from "../src/client-context.js";

interface Theme {
	name: "dark" | "light";
}

const theme = createContext<Theme>(Symbol("theme"));
const providerHost = document.createElement("main");
const consumerHost = document.createElement("button");
const provider = new ContextProvider(providerHost, { context: theme, initialValue: { name: "light" } });
const consumer = new ContextConsumer(consumerHost, {
	context: theme,
	callback(value) {
		this.setAttribute("data-theme", value.name);
	},
	subscribe: true,
});

provider.connect();
consumer.connect();
provider.setValue({ name: "dark" });

consumer.disconnect();
provider.disconnect();
