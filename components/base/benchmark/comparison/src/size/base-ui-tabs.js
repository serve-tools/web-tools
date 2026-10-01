import { Tabs } from "@base-ui/react/tabs";
import * as React from "react";
import { createRoot } from "react-dom/client";

const App = () => {
	const [value, setValue] = React.useState("profile");
	return React.createElement(
		Tabs.Root,
		{ onValueChange: setValue, value },
		React.createElement(
			Tabs.List,
			{ "aria-label": "Account" },
			React.createElement(Tabs.Tab, { value: "profile" }, "Profile"),
			React.createElement(Tabs.Tab, { value: "settings" }, "Settings"),
		),
		React.createElement(Tabs.Panel, { keepMounted: true, value: "profile" }, "Profile content"),
		React.createElement(Tabs.Panel, { keepMounted: true, value: "settings" }, "Settings content"),
	);
};

export const mount = () =>
	createRoot(document.body.appendChild(document.createElement("div"))).render(React.createElement(App));
