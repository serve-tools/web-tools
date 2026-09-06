import * as React from "react";
import { createRoot } from "react-dom/client";

const App = () => {
	const [checked, setChecked] = React.useState(true);
	return React.createElement(
		"form",
		null,
		React.createElement("input", {
			checked,
			id: "weight-checkbox",
			name: "choice",
			onChange: (event) => setChecked(event.currentTarget.checked),
			type: "checkbox",
			value: "on",
		}),
		React.createElement("label", { htmlFor: "weight-checkbox" }, "Option"),
	);
};

createRoot(document.body.appendChild(document.createElement("div"))).render(React.createElement(App));
