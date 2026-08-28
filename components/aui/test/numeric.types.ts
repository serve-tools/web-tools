import type { NumberFieldChangeDetail, NumberFieldEventMap, SliderOrientation } from "@serve-tools/aui";
import { NumberFieldElement, OTPFieldElement, SliderElement } from "@serve-tools/aui";
import type { NumberFieldElement as NumberField } from "@serve-tools/aui/number-field";
import type { OTPFieldElement as OTPField } from "@serve-tools/aui/otp-field";
import type { SliderElement as Slider } from "@serve-tools/aui/slider";

const numberConstructor: typeof NumberField = NumberFieldElement;
const otpConstructor: typeof OTPField = OTPFieldElement;
const sliderConstructor: typeof Slider = SliderElement;
const number = null as unknown as NumberFieldElement;
const otp = null as unknown as OTPFieldElement;
const slider = null as unknown as SliderElement;
const elements: HTMLElement[] = [number, otp, slider];
const numberInput: HTMLInputElement | null = number.input;
const decrement: HTMLButtonElement | null = number.decrementButton;
const increment: HTMLButtonElement | null = number.incrementButton;
const numericValue: number = number.valueAsNumber;
const numberValidity: ValidityState | null = number.validity;
number.value = "2";
number.valueAsNumber = 3;
number.min = "0";
number.max = "12";
number.step = "1";
number.disabled = false;
number.readOnly = true;
number.required = true;
number.stepUp();
number.stepDown(2);
const numberValid: boolean = number.checkValidity();
const numberReported: boolean = number.reportValidity();
number.addEventListener("beforechange", (event) => {
	const typed: NumberFieldEventMap["beforechange"] = event;
	const detail: NumberFieldChangeDetail = event.detail;
	const value: string = detail.value;
	const valueAsNumber: number = detail.valueAsNumber;
	const direction: "decrement" | "increment" = detail.direction;
	const source: MouseEvent | PointerEvent = detail.sourceEvent;
	event.preventDefault();
	// @ts-expect-error Proposed values are immutable.
	detail.value = "4";
	void [typed, value, valueAsNumber, direction, source];
});

const otpInput: HTMLInputElement | null = otp.input;
const segments: readonly Element[] = otp.segments;
const otpValidity: ValidityState | null = otp.validity;
otp.length = 6;
otp.value = "123456";
otp.disabled = false;
otp.readOnly = true;
otp.required = true;
const otpValid: boolean = otp.checkValidity();
const otpReported: boolean = otp.reportValidity();

const inputs: readonly HTMLInputElement[] = slider.inputs;
const values: readonly number[] = slider.values;
const firstValue: number = slider.value;
const orientation: SliderOrientation = slider.orientation;
const multiple: boolean = slider.multiple;
slider.values = [20, 80];
slider.value = 25;
slider.min = "0";
slider.max = "100";
slider.step = "5";
slider.disabled = false;
slider.orientation = "vertical";
// @ts-expect-error Slider values are numeric.
slider.values = ["20", "80"];
// @ts-expect-error Orientation uses a closed vocabulary.
slider.orientation = "diagonal";
// @ts-expect-error Multiple is derived from current native input membership.
slider.multiple = true;
// @ts-expect-error Numeric wrappers do not create another form owner.
number.form;
// @ts-expect-error OTP delegates form ownership to its actual input.
otp.form;
// @ts-expect-error Slider has no portable readonly contract.
slider.readOnly = true;
// @ts-expect-error Input snapshots are immutable.
inputs.push(document.createElement("input"));
void [
	numberConstructor,
	otpConstructor,
	sliderConstructor,
	elements,
	numberInput,
	decrement,
	increment,
	numericValue,
	numberValidity,
	numberValid,
	numberReported,
	otpInput,
	segments,
	otpValidity,
	otpValid,
	otpReported,
	values,
	firstValue,
	orientation,
	multiple,
];
