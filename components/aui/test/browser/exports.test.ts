import * as aui from "@serve-tools/aui";
import { AUIElement } from "@serve-tools/aui/base";
import { DialogElement } from "@serve-tools/aui/dialog";
import { TabsElement } from "@serve-tools/aui/tabs";
import { expect, test } from "vitest";

test("published component entries agree and imports do not register tag names", () => {
	expect(Object.keys(aui).sort()).toEqual(["AUIElement", "DialogElement", "TabsElement"]);
	expect(aui.AUIElement).toBe(AUIElement);
	expect(aui.DialogElement).toBe(DialogElement);
	expect(aui.TabsElement).toBe(TabsElement);
	expect(customElements.get("aui-dialog")).toBeUndefined();
	expect(customElements.get("aui-tabs")).toBeUndefined();
});
