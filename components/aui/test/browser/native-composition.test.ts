import { CheckboxElement } from "@serve-tools/aui/checkbox";
import { afterEach, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

customElements.define("native-compose-checkbox", CheckboxElement);
const fixture = document.createElement("div");
document.body.append(fixture);
afterEach(() => fixture.replaceChildren());

test("a native form has one submitted identity for native and AUI controls, including its submitter", async () => {
	fixture.innerHTML = `<form><input name="text" value="authored" required>
		<native-compose-checkbox name="enabled" value="yes" checked></native-compose-checkbox>
		<button type="submit" name="action" value="save">Save</button><button type="reset">Reset</button></form>`;
	const form = fixture.querySelector("form")!;
	const input = form.querySelector("input")!;
	const checkbox = form.querySelector<CheckboxElement>("native-compose-checkbox")!;
	let submitted: [string, FormDataEntryValue][] = [];
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		submitted = Array.from(new FormData(form, event.submitter));
	});
	await userEvent.fill(input, "edited");
	await userEvent.click(form.querySelector("button")!);
	expect(submitted).toEqual([
		["text", "edited"],
		["enabled", "yes"],
		["action", "save"],
	]);
	expect(form.elements).toHaveLength(4);
	checkbox.checked = false;
	input.value = "";
	expect(form.checkValidity()).toBe(false);
	form.reset();
	expect(form.checkValidity()).toBe(true);
	expect(input.value).toBe("authored");
	expect(checkbox.checked).toBe(true);
});

test("disabled fieldsets keep the first legend active without changing authored child disabled properties", () => {
	fixture.innerHTML = `<form><fieldset disabled><legend><input name="legend" value="kept"></legend>
		<input name="native" value="omitted"><native-compose-checkbox name="custom" checked></native-compose-checkbox>
		<legend><input name="second-legend" value="omitted"></legend></fieldset></form>`;
	const form = fixture.querySelector("form")!;
	const fieldset = form.querySelector("fieldset")!;
	const input = form.querySelector<HTMLInputElement>("input[name=native]")!;
	const checkbox = form.querySelector<CheckboxElement>("native-compose-checkbox")!;
	expect(Array.from(new FormData(form))).toEqual([["legend", "kept"]]);
	expect(input.disabled).toBe(false);
	expect(input.matches(":disabled")).toBe(true);
	expect(checkbox.disabled).toBe(false);
	expect(checkbox.matches(":disabled")).toBe(true);
	fieldset.disabled = false;
	expect(new FormData(form).get("custom")).toBe("on");
	expect(new FormData(form).get("native")).toBe("omitted");
});

test("native radio grouping follows form owner and name, including external peers and dynamic name changes", () => {
	fixture.innerHTML = `<form id="radio-owner"><fieldset><legend>First group</legend>
		<input type="radio" name="choice" value="first" checked></fieldset></form>
		<input type="radio" form="radio-owner" name="choice" value="external">
		<form id="other-radio-owner"><input type="radio" name="choice" value="independent" checked></form>`;
	const form = fixture.querySelector<HTMLFormElement>("#radio-owner")!;
	const first = form.querySelector("input")!;
	const external = fixture.querySelector<HTMLInputElement>("input[form]")!;
	const independent = fixture.querySelector<HTMLInputElement>("input[value=independent]")!;
	external.checked = true;
	expect(first.checked).toBe(false);
	expect(independent.checked).toBe(true);
	expect(new FormData(form).getAll("choice")).toEqual(["external"]);
	external.name = "different";
	first.checked = true;
	expect(external.checked).toBe(true);
	external.name = "choice";
	expect(first.checked).toBe(false);
	expect(new FormData(form).getAll("choice")).toEqual(["external"]);
});

test("native radio labels, arrows, disabled entries, and reset retain browser behavior", async () => {
	fixture.innerHTML = `<form><fieldset><legend>Contact</legend>
		<label><input type="radio" name="contact" value="email" checked required>Email</label>
		<label><input type="radio" name="contact" value="phone">Phone</label>
		<label><input type="radio" name="contact" value="post" disabled>Post</label></fieldset></form>`;
	const form = fixture.querySelector("form")!;
	const [email, phone, post] = form.querySelectorAll("input");
	await userEvent.click(phone!.closest("label")!);
	expect(new FormData(form).getAll("contact")).toEqual(["phone"]);
	// Native pointer-focus policy varies by browser; keyboard navigation starts from explicit focus.
	phone!.focus();
	expect(document.activeElement).toBe(phone);
	await userEvent.keyboard("{ArrowUp}");
	expect(post!.checked).toBe(false);
	expect(email!.checked).toBe(true);
	expect(document.activeElement).toBe(email);
	phone!.checked = true;
	form.reset();
	expect(email!.checked).toBe(true);
	expect(phone!.checked).toBe(false);
	email!.checked = false;
	expect(form.checkValidity()).toBe(false);
	expect(phone!.validity.valueMissing).toBe(true);
});

test("canceling a native radio click restores both its previous peer and form value", async () => {
	fixture.innerHTML = `<form><input type="radio" name="choice" value="first" checked>
		<input type="radio" name="choice" value="second"></form>`;
	const form = fixture.querySelector("form")!;
	const [first, second] = form.querySelectorAll("input");
	let changes = 0;
	second!.addEventListener("change", () => ++changes);
	second!.addEventListener("click", (event) => event.preventDefault(), { once: true });
	await userEvent.click(second!);
	expect(second!.checked).toBe(false);
	expect(first!.checked).toBe(true);
	expect(new FormData(form).getAll("choice")).toEqual(["first"]);
	expect(changes).toBe(0);
	await userEvent.click(second!);
	expect(changes).toBe(1);
	expect(new FormData(form).getAll("choice")).toEqual(["second"]);
});
