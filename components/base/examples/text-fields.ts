import type { TextFieldElement } from "@serve-tools/base-components";

/** Demonstrates shadow-owned text editing and independently controlled secret masking. */
export function initializeTextFieldExamples(): void {
	const form = document.querySelector<HTMLFormElement>("#text-field-form")!;
	const result = document.querySelector<HTMLOutputElement>("#text-field-result")!;
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		result.textContent = `Email: ${new FormData(form).get("email")}`;
	});
	form.addEventListener("reset", () => {
		result.textContent = "No email submitted.";
	});

	const secret = document.querySelector<TextFieldElement>("#example-secret")!;
	const reveal = document.querySelector<HTMLButtonElement>("#secret-reveal")!;
	const status = document.querySelector<HTMLOutputElement>("#secret-result")!;
	// Pointer reveal keeps the editor's focus and selection; keyboard activation stays native.
	reveal.addEventListener("pointerdown", (event) => {
		if (event.button === 0) {
			event.preventDefault();
		}
	});
	reveal.addEventListener("click", () => {
		secret.revealed = !secret.revealed;
		reveal.textContent = secret.revealed ? "Hide" : "Reveal";
		reveal.setAttribute("aria-pressed", String(secret.revealed));
		status.textContent = secret.revealed ? "Example secret is visible." : "Example secret is masked.";
	});
	document.querySelector("#secret-copy")!.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(secret.value);
			status.textContent = "Copied the example secret with its line breaks.";
		} catch {
			secret.focus();
			secret.select();
			status.textContent = "Example secret selected. Use your browser’s Copy command.";
		}
	});
}
