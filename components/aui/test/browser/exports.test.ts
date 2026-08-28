import * as aui from "@serve-tools/aui";
import { AUIElement } from "@serve-tools/aui/base";
import { CheckboxElement } from "@serve-tools/aui/checkbox";
import { DialogElement } from "@serve-tools/aui/dialog";
import { TabsElement } from "@serve-tools/aui/tabs";
import { ToggleElement } from "@serve-tools/aui/toggle";
import { ToggleGroupElement } from "@serve-tools/aui/toggle-group";
import { expect, test } from "vitest";

test("published component entries agree and imports do not register tag names", () => {
	expect(Object.keys(aui).sort()).toEqual([
		"AUIElement",
		"CheckboxElement",
		"DialogElement",
		"TabsElement",
		"ToggleElement",
		"ToggleGroupElement",
	]);
	expect(aui.AUIElement).toBe(AUIElement);
	expect(aui.CheckboxElement).toBe(CheckboxElement);
	expect(aui.DialogElement).toBe(DialogElement);
	expect(aui.TabsElement).toBe(TabsElement);
	expect(aui.ToggleElement).toBe(ToggleElement);
	expect(aui.ToggleGroupElement).toBe(ToggleGroupElement);
	expect(customElements.get("aui-checkbox")).toBeUndefined();
	expect(customElements.get("aui-dialog")).toBeUndefined();
	expect(customElements.get("aui-tabs")).toBeUndefined();
	expect(customElements.get("aui-toggle")).toBeUndefined();
	expect(customElements.get("aui-toggle-group")).toBeUndefined();
});
