import type { FieldElement, NumberFieldElement, OTPFieldElement, SliderElement } from "@serve-tools/aui";

/** Wires the field and numeric examples without replacing native input behavior. */
export function initializeFieldExamples(): void {
	const field = document.querySelector<FieldElement>("#email-field")!;
	const email = field.querySelector<HTMLInputElement>("input")!;
	const fieldForm = document.querySelector<HTMLFormElement>("#field-form")!;
	const fieldStatus = document.querySelector<HTMLOutputElement>("#field-state")!;
	const renderField = (): void => {
		field.refresh();
		fieldStatus.textContent = [
			field.valid ? "valid" : "invalid",
			field.dirty ? "changed" : "pristine",
			field.touched ? "visited" : "unvisited",
		].join(" · ");
	};
	field.addEventListener("input", renderField);
	field.addEventListener("focusout", () => queueMicrotask(renderField));
	document.querySelector("#field-server-error")!.addEventListener("click", () => {
		email.setCustomValidity("This address is already in use.");
		field.querySelector("[slot=error]")!.textContent = "This address is already in use.";
		renderField();
	});
	document.querySelector("#field-clear-error")!.addEventListener("click", () => {
		email.setCustomValidity("");
		field.querySelector("[slot=error]")!.textContent = "Enter a valid email address.";
		renderField();
	});
	fieldForm.addEventListener("submit", (event) => {
		event.preventDefault();
		document.querySelector("#field-result")!.textContent = `Email: ${new FormData(fieldForm).get("email")}`;
	});
	fieldForm.addEventListener("reset", () => {
		email.setCustomValidity("");
		field.querySelector("[slot=error]")!.textContent = "Enter a valid email address.";
		queueMicrotask(renderField);
		document.querySelector("#field-result")!.textContent = "No field submitted.";
	});
	renderField();

	const number = document.querySelector<NumberFieldElement>("#quantity-field")!;
	const otp = document.querySelector<OTPFieldElement>("#code-field")!;
	const slider = document.querySelector<SliderElement>("#price-slider")!;
	const volume = document.querySelector<SliderElement>("#volume-slider")!;
	const renderNumber = (): void => {
		document.querySelector("#quantity-value")!.textContent = `Quantity: ${number.value || "empty"}`;
	};
	const renderOTP = (): void => {
		document.querySelector("#code-value")!.textContent = `${otp.value.length} of ${otp.length} characters entered`;
	};
	const renderSlider = (): void => {
		const [minimum, maximum] = slider.values;
		document.querySelector("#price-value")!.textContent = `Price interval: $${minimum}–$${maximum}`;
		document.querySelector("#volume-value")!.textContent = `Volume: ${volume.value}%`;
	};
	for (const [host, render] of [
		[number, renderNumber],
		[otp, renderOTP],
		[slider, renderSlider],
		[volume, renderSlider],
	] as const) {
		const target: HTMLElement = host;
		target.addEventListener("input", render);
		render();
	}
	for (const [id, render] of [
		["number-form", renderNumber],
		["otp-form", renderOTP],
		["slider-form", renderSlider],
	] as const) {
		const form = document.querySelector<HTMLFormElement>("#" + id)!;
		const result = form.querySelector<HTMLOutputElement>("[data-submission]")!;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			result.textContent = Array.from(new FormData(form), ([name, value]) => `${name}: ${value}`).join("; ");
		});
		form.addEventListener("reset", () => {
			queueMicrotask(render);
			result.textContent = "No values submitted.";
		});
	}
}
