import * as base from "@serve-tools/base-components";
import { AccordionElement } from "@serve-tools/base-components/accordion";
import { AlertDialogElement } from "@serve-tools/base-components/alert-dialog";
import { AutocompleteElement } from "@serve-tools/base-components/autocomplete";
import { AvatarElement } from "@serve-tools/base-components/avatar";
import { BaseElement } from "@serve-tools/base-components/base";
import { CalendarElement } from "@serve-tools/base-components/calendar";
import { CheckboxElement } from "@serve-tools/base-components/checkbox";
import { CheckboxGroupElement } from "@serve-tools/base-components/checkbox-group";
import { CollapsibleElement } from "@serve-tools/base-components/collapsible";
import { ComboboxElement } from "@serve-tools/base-components/combobox";
import { ContextMenuElement } from "@serve-tools/base-components/context-menu";
import { DialogElement } from "@serve-tools/base-components/dialog";
import { DrawerElement } from "@serve-tools/base-components/drawer";
import { FieldElement } from "@serve-tools/base-components/field";
import { FileElement } from "@serve-tools/base-components/file";
import { FormAssociatedElement } from "@serve-tools/base-components/form-associated";
import { MenuElement } from "@serve-tools/base-components/menu";
import { MenubarElement } from "@serve-tools/base-components/menubar";
import { MeterElement } from "@serve-tools/base-components/meter";
import { NavigationMenuElement } from "@serve-tools/base-components/navigation-menu";
import { NumberFieldElement } from "@serve-tools/base-components/number-field";
import { OptionElement } from "@serve-tools/base-components/option";
import { OTPFieldElement } from "@serve-tools/base-components/otp-field";
import { PopoverElement } from "@serve-tools/base-components/popover";
import { PreviewCardElement } from "@serve-tools/base-components/preview-card";
import { ProgressElement } from "@serve-tools/base-components/progress";
import { ScrollAreaElement } from "@serve-tools/base-components/scroll-area";
import { SelectElement } from "@serve-tools/base-components/select";
import { SeparatorElement } from "@serve-tools/base-components/separator";
import { SliderElement } from "@serve-tools/base-components/slider";
import { SwitchElement } from "@serve-tools/base-components/switch";
import { TabsElement } from "@serve-tools/base-components/tabs";
import { ToastRegionElement } from "@serve-tools/base-components/toast-region";
import { ToggleElement } from "@serve-tools/base-components/toggle";
import { ToggleGroupElement } from "@serve-tools/base-components/toggle-group";
import { ToolbarElement } from "@serve-tools/base-components/toolbar";
import { TooltipElement } from "@serve-tools/base-components/tooltip";
import { expect, test } from "vitest";

test("published component entries agree and imports do not register tag names", () => {
	expect(Object.keys(base).sort()).toEqual([
		"AccordionElement",
		"AlertDialogElement",
		"AutocompleteElement",
		"AvatarElement",
		"BaseElement",
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
	expect(base.BaseElement).toBe(BaseElement);
	expect(base.AccordionElement).toBe(AccordionElement);
	expect(base.AlertDialogElement).toBe(AlertDialogElement);
	expect(base.AutocompleteElement).toBe(AutocompleteElement);
	expect(base.AvatarElement).toBe(AvatarElement);
	expect(base.CalendarElement).toBe(CalendarElement);
	expect(base.CheckboxElement).toBe(CheckboxElement);
	expect(base.CheckboxGroupElement).toBe(CheckboxGroupElement);
	expect(base.CollapsibleElement).toBe(CollapsibleElement);
	expect(base.ComboboxElement).toBe(ComboboxElement);
	expect(base.ContextMenuElement).toBe(ContextMenuElement);
	expect(base.DialogElement).toBe(DialogElement);
	expect(base.DrawerElement).toBe(DrawerElement);
	expect(base.FieldElement).toBe(FieldElement);
	expect(base.FileElement).toBe(FileElement);
	expect(base.FormAssociatedElement).toBe(FormAssociatedElement);
	expect(base.MenuElement).toBe(MenuElement);
	expect(base.MenubarElement).toBe(MenubarElement);
	expect(base.MeterElement).toBe(MeterElement);
	expect(base.NavigationMenuElement).toBe(NavigationMenuElement);
	expect(base.NumberFieldElement).toBe(NumberFieldElement);
	expect(base.OTPFieldElement).toBe(OTPFieldElement);
	expect(base.OptionElement).toBe(OptionElement);
	expect(base.PopoverElement).toBe(PopoverElement);
	expect(base.PreviewCardElement).toBe(PreviewCardElement);
	expect(base.ProgressElement).toBe(ProgressElement);
	expect(base.ScrollAreaElement).toBe(ScrollAreaElement);
	expect(base.SelectElement).toBe(SelectElement);
	expect(base.SeparatorElement).toBe(SeparatorElement);
	expect(base.SliderElement).toBe(SliderElement);
	expect(base.SwitchElement).toBe(SwitchElement);
	expect(base.TabsElement).toBe(TabsElement);
	expect(base.ToastRegionElement).toBe(ToastRegionElement);
	expect(base.ToggleElement).toBe(ToggleElement);
	expect(base.ToggleGroupElement).toBe(ToggleGroupElement);
	expect(base.ToolbarElement).toBe(ToolbarElement);
	expect(base.TooltipElement).toBe(TooltipElement);
	expect(customElements.get("base-checkbox")).toBeUndefined();
	expect(customElements.get("base-accordion")).toBeUndefined();
	expect(customElements.get("base-collapsible")).toBeUndefined();
	expect(customElements.get("base-dialog")).toBeUndefined();
	expect(customElements.get("base-field")).toBeUndefined();
	expect(customElements.get("base-form-associated")).toBeUndefined();
	expect(customElements.get("base-avatar")).toBeUndefined();
	expect(customElements.get("base-meter")).toBeUndefined();
	expect(customElements.get("base-progress")).toBeUndefined();
	expect(customElements.get("base-separator")).toBeUndefined();
	expect(customElements.get("base-tabs")).toBeUndefined();
	expect(customElements.get("base-toggle")).toBeUndefined();
	expect(customElements.get("base-toggle-group")).toBeUndefined();
	expect(customElements.get("base-alert-dialog")).toBeUndefined();
	expect(customElements.get("base-checkbox-group")).toBeUndefined();
	expect(customElements.get("base-popover")).toBeUndefined();
	expect(customElements.get("base-preview-card")).toBeUndefined();
	expect(customElements.get("base-switch")).toBeUndefined();
	expect(customElements.get("base-tooltip")).toBeUndefined();
	expect(customElements.get("base-number-field")).toBeUndefined();
	expect(customElements.get("base-otp-field")).toBeUndefined();
	expect(customElements.get("base-slider")).toBeUndefined();
	expect(customElements.get("base-autocomplete")).toBeUndefined();
	expect(customElements.get("base-combobox")).toBeUndefined();
	expect(customElements.get("base-option")).toBeUndefined();
	expect(customElements.get("base-select")).toBeUndefined();
	expect(customElements.get("base-context-menu")).toBeUndefined();
	expect(customElements.get("base-menu")).toBeUndefined();
	expect(customElements.get("base-menubar")).toBeUndefined();
	expect(customElements.get("base-navigation-menu")).toBeUndefined();
	expect(customElements.get("base-toolbar")).toBeUndefined();
	expect(customElements.get("base-calendar")).toBeUndefined();
	expect(customElements.get("base-drawer")).toBeUndefined();
	expect(customElements.get("base-file")).toBeUndefined();
	expect(customElements.get("base-scroll-area")).toBeUndefined();
	expect(customElements.get("base-toast-region")).toBeUndefined();
});
