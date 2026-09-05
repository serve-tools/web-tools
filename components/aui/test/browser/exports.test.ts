import * as aui from "@serve-tools/aui";
import { AccordionElement } from "@serve-tools/aui/accordion";
import { AlertDialogElement } from "@serve-tools/aui/alert-dialog";
import { AutocompleteElement } from "@serve-tools/aui/autocomplete";
import { AvatarElement } from "@serve-tools/aui/avatar";
import { AUIElement } from "@serve-tools/aui/base";
import { CalendarElement } from "@serve-tools/aui/calendar";
import { CheckboxElement } from "@serve-tools/aui/checkbox";
import { CheckboxGroupElement } from "@serve-tools/aui/checkbox-group";
import { CollapsibleElement } from "@serve-tools/aui/collapsible";
import { ComboboxElement } from "@serve-tools/aui/combobox";
import { ContextMenuElement } from "@serve-tools/aui/context-menu";
import { DialogElement } from "@serve-tools/aui/dialog";
import { DrawerElement } from "@serve-tools/aui/drawer";
import { FieldElement } from "@serve-tools/aui/field";
import { FileElement } from "@serve-tools/aui/file";
import { FormAssociatedElement } from "@serve-tools/aui/form-associated";
import { MenuElement } from "@serve-tools/aui/menu";
import { MenubarElement } from "@serve-tools/aui/menubar";
import { MeterElement } from "@serve-tools/aui/meter";
import { NavigationMenuElement } from "@serve-tools/aui/navigation-menu";
import { NumberFieldElement } from "@serve-tools/aui/number-field";
import { OptionElement } from "@serve-tools/aui/option";
import { OTPFieldElement } from "@serve-tools/aui/otp-field";
import { PopoverElement } from "@serve-tools/aui/popover";
import { PreviewCardElement } from "@serve-tools/aui/preview-card";
import { ProgressElement } from "@serve-tools/aui/progress";
import { ScrollAreaElement } from "@serve-tools/aui/scroll-area";
import { SelectElement } from "@serve-tools/aui/select";
import { SeparatorElement } from "@serve-tools/aui/separator";
import { SliderElement } from "@serve-tools/aui/slider";
import { SwitchElement } from "@serve-tools/aui/switch";
import { TabsElement } from "@serve-tools/aui/tabs";
import { ToastRegionElement } from "@serve-tools/aui/toast-region";
import { ToggleElement } from "@serve-tools/aui/toggle";
import { ToggleGroupElement } from "@serve-tools/aui/toggle-group";
import { ToolbarElement } from "@serve-tools/aui/toolbar";
import { TooltipElement } from "@serve-tools/aui/tooltip";
import { expect, test } from "vitest";

test("published component entries agree and imports do not register tag names", () => {
	expect(Object.keys(aui).sort()).toEqual([
		"AUIElement",
		"AccordionElement",
		"AlertDialogElement",
		"AutocompleteElement",
		"AvatarElement",
		"CalendarElement",
		"CheckboxElement",
		"CheckboxGroupElement",
		"CollapsibleElement",
		"ComboboxElement",
		"ContextMenuElement",
		"DialogElement",
		"DrawerElement",
		"FieldElement",
		"FileElement",
		"FormAssociatedElement",
		"MenuElement",
		"MenubarElement",
		"MeterElement",
		"NavigationMenuElement",
		"NumberFieldElement",
		"OTPFieldElement",
		"OptionElement",
		"PopoverElement",
		"PreviewCardElement",
		"ProgressElement",
		"ScrollAreaElement",
		"SelectElement",
		"SeparatorElement",
		"SliderElement",
		"SwitchElement",
		"TabsElement",
		"ToastRegionElement",
		"ToggleElement",
		"ToggleGroupElement",
		"ToolbarElement",
		"TooltipElement",
	]);
	expect(aui.AUIElement).toBe(AUIElement);
	expect(aui.AccordionElement).toBe(AccordionElement);
	expect(aui.AlertDialogElement).toBe(AlertDialogElement);
	expect(aui.AutocompleteElement).toBe(AutocompleteElement);
	expect(aui.AvatarElement).toBe(AvatarElement);
	expect(aui.CalendarElement).toBe(CalendarElement);
	expect(aui.CheckboxElement).toBe(CheckboxElement);
	expect(aui.CheckboxGroupElement).toBe(CheckboxGroupElement);
	expect(aui.CollapsibleElement).toBe(CollapsibleElement);
	expect(aui.ComboboxElement).toBe(ComboboxElement);
	expect(aui.ContextMenuElement).toBe(ContextMenuElement);
	expect(aui.DialogElement).toBe(DialogElement);
	expect(aui.DrawerElement).toBe(DrawerElement);
	expect(aui.FieldElement).toBe(FieldElement);
	expect(aui.FileElement).toBe(FileElement);
	expect(aui.FormAssociatedElement).toBe(FormAssociatedElement);
	expect(aui.MenuElement).toBe(MenuElement);
	expect(aui.MenubarElement).toBe(MenubarElement);
	expect(aui.MeterElement).toBe(MeterElement);
	expect(aui.NavigationMenuElement).toBe(NavigationMenuElement);
	expect(aui.NumberFieldElement).toBe(NumberFieldElement);
	expect(aui.OTPFieldElement).toBe(OTPFieldElement);
	expect(aui.OptionElement).toBe(OptionElement);
	expect(aui.PopoverElement).toBe(PopoverElement);
	expect(aui.PreviewCardElement).toBe(PreviewCardElement);
	expect(aui.ProgressElement).toBe(ProgressElement);
	expect(aui.ScrollAreaElement).toBe(ScrollAreaElement);
	expect(aui.SelectElement).toBe(SelectElement);
	expect(aui.SeparatorElement).toBe(SeparatorElement);
	expect(aui.SliderElement).toBe(SliderElement);
	expect(aui.SwitchElement).toBe(SwitchElement);
	expect(aui.TabsElement).toBe(TabsElement);
	expect(aui.ToastRegionElement).toBe(ToastRegionElement);
	expect(aui.ToggleElement).toBe(ToggleElement);
	expect(aui.ToggleGroupElement).toBe(ToggleGroupElement);
	expect(aui.ToolbarElement).toBe(ToolbarElement);
	expect(aui.TooltipElement).toBe(TooltipElement);
	expect(customElements.get("aui-checkbox")).toBeUndefined();
	expect(customElements.get("aui-accordion")).toBeUndefined();
	expect(customElements.get("aui-collapsible")).toBeUndefined();
	expect(customElements.get("aui-dialog")).toBeUndefined();
	expect(customElements.get("aui-field")).toBeUndefined();
	expect(customElements.get("aui-form-associated")).toBeUndefined();
	expect(customElements.get("aui-avatar")).toBeUndefined();
	expect(customElements.get("aui-meter")).toBeUndefined();
	expect(customElements.get("aui-progress")).toBeUndefined();
	expect(customElements.get("aui-separator")).toBeUndefined();
	expect(customElements.get("aui-tabs")).toBeUndefined();
	expect(customElements.get("aui-toggle")).toBeUndefined();
	expect(customElements.get("aui-toggle-group")).toBeUndefined();
	expect(customElements.get("aui-alert-dialog")).toBeUndefined();
	expect(customElements.get("aui-checkbox-group")).toBeUndefined();
	expect(customElements.get("aui-popover")).toBeUndefined();
	expect(customElements.get("aui-preview-card")).toBeUndefined();
	expect(customElements.get("aui-switch")).toBeUndefined();
	expect(customElements.get("aui-tooltip")).toBeUndefined();
	expect(customElements.get("aui-number-field")).toBeUndefined();
	expect(customElements.get("aui-otp-field")).toBeUndefined();
	expect(customElements.get("aui-slider")).toBeUndefined();
	expect(customElements.get("aui-autocomplete")).toBeUndefined();
	expect(customElements.get("aui-combobox")).toBeUndefined();
	expect(customElements.get("aui-option")).toBeUndefined();
	expect(customElements.get("aui-select")).toBeUndefined();
	expect(customElements.get("aui-context-menu")).toBeUndefined();
	expect(customElements.get("aui-menu")).toBeUndefined();
	expect(customElements.get("aui-menubar")).toBeUndefined();
	expect(customElements.get("aui-navigation-menu")).toBeUndefined();
	expect(customElements.get("aui-toolbar")).toBeUndefined();
	expect(customElements.get("aui-calendar")).toBeUndefined();
	expect(customElements.get("aui-drawer")).toBeUndefined();
	expect(customElements.get("aui-file")).toBeUndefined();
	expect(customElements.get("aui-scroll-area")).toBeUndefined();
	expect(customElements.get("aui-toast-region")).toBeUndefined();
});
