import { Checkbox } from "@base-ui/react/checkbox";
import * as React from "react";
import { createRoot } from "react-dom/client";

const App = () => {
	const [checked, setChecked] = React.useState(true);
	return React.createElement(
		React.Fragment,
		null,
		React.createElement(Checkbox.Root, {
			checked,
			id: "weight-checkbox",
			name: "choice",
			nativeButton: true,
			onCheckedChange: setChecked,
			render: React.createElement("button", { type: "button" }),
			value: "on",
		}),
		React.createElement("label", { htmlFor: "weight-checkbox" }, "Option"),
	);
};

export const mount = () =>
	createRoot(document.body.appendChild(document.createElement("div"))).render(React.createElement(App));
