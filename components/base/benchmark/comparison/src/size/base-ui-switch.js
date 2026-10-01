import { Switch } from "@base-ui/react/switch";
import * as React from "react";
import { createRoot } from "react-dom/client";

const App = () => {
	const [checked, setChecked] = React.useState(true);
	return React.createElement(
		React.Fragment,
		null,
		React.createElement(Switch.Root, {
			checked,
			id: "weight-switch",
			name: "enabled",
			onCheckedChange: setChecked,
			value: "yes",
		}),
		React.createElement("label", { htmlFor: "weight-switch" }, "Enabled"),
	);
};

export const mount = () =>
	createRoot(document.body.appendChild(document.createElement("div"))).render(React.createElement(App));
