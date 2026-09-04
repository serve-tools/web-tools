import type { ComboboxElement, OptionElement, SelectElement } from "@serve-tools/aui";

/** Displays selection without replacing the authored control or its native events. */
export function initializeSelectionExamples(): void {
	const single = document.querySelector<SelectElement>("#plan-select")!;
	const multiple = document.querySelector<SelectElement>("#region-select")!;
	const combo = document.querySelector<ComboboxElement>("#language-combobox")!;
	const renderSingle = (): void => {
		const selected = Array.from(single.querySelectorAll<OptionElement>("app-option")).find(
			(option) => option.selected,
		);
		single.querySelector("button")!.textContent = selected?.label ?? "Choose a plan";
	};
	const renderMultiple = (): void => {
		const labels = Array.from(multiple.querySelectorAll<OptionElement>("app-option"))
			.filter((option) => option.selected)
			.map((option) => option.label);
		multiple.querySelector("button")!.textContent = labels.join(", ") || "Choose regions";
		document.querySelector("#region-values")!.textContent =
			`Selected identities: ${JSON.stringify(multiple.values)}`;
	};
	const renderCombo = (): void => {
		document.querySelector("#language-value")!.textContent = `Selected identity: ${combo.value || "none"}`;
	};
	single.addEventListener("change", renderSingle);
	multiple.addEventListener("change", renderMultiple);
	combo.addEventListener("change", renderCombo);
	renderSingle();
	renderMultiple();
	renderCombo();
	for (const id of ["autocomplete-form", "combobox-form", "select-form"]) {
		const form = document.querySelector<HTMLFormElement>("#" + id)!;
		const result = form.querySelector<HTMLOutputElement>("[data-submission]")!;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			result.textContent = Array.from(new FormData(form), ([name, value]) => `${name}: ${value}`).join("; ");
		});
		form.addEventListener("reset", () => {
			queueMicrotask(() => {
				renderSingle();
				renderMultiple();
				renderCombo();
			});
			result.textContent = "No values submitted.";
		});
	}
}
