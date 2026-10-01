import type { TextFieldElement, TextFieldType } from "@serve-tools/base-components";
import type { TextFieldElement as TextField } from "@serve-tools/base-components/text-field";

const field = null as unknown as TextFieldElement;
const type: TextFieldType = "password";
field.type = type;
field.multiline = true;
field.revealed = false;
field.value = "secret";
field.label = "Secret";
field.setSelectionRange(0, 3);
const input: HTMLInputElement | HTMLTextAreaElement | null = field.input;
// @ts-expect-error Numeric input is outside text-entry intent.
field.type = "number";
void input;

const publicSubpath: TextField = field;
void publicSubpath;
