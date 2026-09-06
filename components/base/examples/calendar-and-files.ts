import type { CalendarElement, FieldElement, FileElement } from "@serve-tools/base-components";

/** Displays local calendar and file state without creating a hidden form identity or uploading data. */
export function initializeCalendarAndFileExamples(): void {
	const calendar = document.querySelector<CalendarElement>("#booking-calendar")!;
	const month = document.querySelector<HTMLInputElement>("#calendar-month")!;
	const renderCalendar = (): void => {
		month.value = calendar.month;
		document.querySelector("#calendar-result")!.textContent = `Selected date: ${calendar.value || "none"}`;
	};
	calendar.addEventListener("input", renderCalendar);
	calendar.addEventListener("keydown", () => queueMicrotask(renderCalendar));
	month.addEventListener("change", () => {
		if (month.value) {
			calendar.showMonth(month.value);
		}
	});
	document.querySelector("#calendar-clear")!.addEventListener("click", () => {
		calendar.value = "";
		renderCalendar();
	});
	renderCalendar();

	const file = document.querySelector<FileElement>("#attachments")!;
	const form = document.querySelector<HTMLFormElement>("#file-form")!;
	const field = file.parentElement as FieldElement;
	const renderFiles = (): void => {
		const files = file.files;
		document.querySelector("#file-list")!.textContent = files.length
			? files.map((entry) => `${entry.name} (${entry.size} bytes)`).join(", ")
			: "No files selected.";
		field.refresh();
	};
	file.addEventListener("change", renderFiles);
	document.querySelector("#sample-file")!.addEventListener("click", () => {
		file.files = [new File(["A local Base gallery example.\n"], "example.txt", { type: "text/plain" })];
		renderFiles();
	});
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const files = new FormData(form).getAll("attachments") as File[];
		document.querySelector("#file-result")!.textContent =
			`Local form files: ${files.map((entry) => entry.name).join(", ")}`;
	});
	form.addEventListener("reset", () => {
		queueMicrotask(renderFiles);
		document.querySelector("#file-result")!.textContent = "Nothing uploaded; this form stays local.";
	});
	renderFiles();
}
