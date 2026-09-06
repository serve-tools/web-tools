import type {
	CalendarChangeDetail,
	CalendarEventMap,
	FileChangeDetail,
	FileEventMap,
} from "@serve-tools/base-components";
import { CalendarElement, FileElement } from "@serve-tools/base-components";
import type { CalendarElement as Calendar } from "@serve-tools/base-components/calendar";
import type { FileElement as FileControl } from "@serve-tools/base-components/file";

const calendarConstructor: typeof Calendar = CalendarElement;
const fileConstructor: typeof FileControl = FileElement;
const calendar = null as unknown as CalendarElement;
const file = null as unknown as FileElement;
calendar.value = "2026-08-28";
calendar.month = "2026-08";
calendar.min = "2026-08-01";
calendar.max = "2026-12-31";
calendar.locale = "en-US";
calendar.weekStartsOn = 1;
calendar.disabled = false;
calendar.focusDate = "2026-08-29";
calendar.select("");
calendar.showMonth("2026-09");
const onDate = (event: CalendarEventMap["beforechange"]): void => {
	const detail: CalendarChangeDetail = event.detail;
	const value: string = detail.value;
	const source: Event = detail.sourceEvent;
	event.preventDefault();
	// @ts-expect-error A proposal is immutable.
	detail.value = "2026-09-01";
	void [value, source];
};
calendar.addEventListener("beforechange", onDate);
calendar.removeEventListener("beforechange", onDate);
calendar.removeEventListener("custom", null);

const input: HTMLInputElement | null = file.input;
const files: readonly File[] = file.files;
file.files = files;
file.maxSize = 1024;
file.maxSize = undefined;
file.refresh();
file.pick();
const onFiles = (event: FileEventMap["beforechange"]): void => {
	const detail: FileChangeDetail = event.detail;
	const source: DragEvent = detail.sourceEvent;
	event.preventDefault();
	// @ts-expect-error Proposed file arrays are immutable.
	detail.files.push(new File([], "example.txt"));
	void source;
};
file.addEventListener("beforechange", onFiles);
file.removeEventListener("beforechange", onFiles);
file.removeEventListener("custom", null);
// @ts-expect-error Calendar has no implicit form identity.
calendar.form;
// @ts-expect-error File delegates form identity to its input.
file.form;
// @ts-expect-error File input composition is readonly.
file.input = input;
// @ts-expect-error Snapshots are readonly.
files.push(new File([], "extra.txt"));
void [calendarConstructor, fileConstructor, input];
