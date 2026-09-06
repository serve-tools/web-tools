import type { AvatarStatus, ProgressStatus, SeparatorOrientation } from "@serve-tools/base-components";
import { AvatarElement, MeterElement, ProgressElement, SeparatorElement } from "@serve-tools/base-components";
import type { AvatarElement as Avatar } from "@serve-tools/base-components/avatar";
import type { MeterElement as Meter } from "@serve-tools/base-components/meter";
import type { ProgressElement as Progress } from "@serve-tools/base-components/progress";
import type { SeparatorElement as Separator } from "@serve-tools/base-components/separator";

const avatarConstructor: typeof Avatar = AvatarElement;
const meterConstructor: typeof Meter = MeterElement;
const progressConstructor: typeof Progress = ProgressElement;
const separatorConstructor: typeof Separator = SeparatorElement;
const avatar = null as unknown as AvatarElement;
const meter = null as unknown as MeterElement;
const progress = null as unknown as ProgressElement;
const separator = null as unknown as SeparatorElement;
const avatarStatus: AvatarStatus = avatar.status;
const progressStatus: ProgressStatus = progress.status;
const orientation: SeparatorOrientation = separator.orientation;
const image: HTMLImageElement = avatar.image;
const nativeMeter: HTMLMeterElement = meter.meter;
const nativeProgress: HTMLProgressElement = progress.progress;
const rule: HTMLHRElement = separator.separator;
const elements: HTMLElement[] = [avatar, meter, progress, separator];
avatar.src = "/avatar.svg";
avatar.alt = "Example avatar";
avatar.delay = 200;
meter.min = 0;
meter.max = 100;
meter.low = 30;
meter.high = 80;
meter.optimum = 50;
meter.value = 45;
progress.max = 100;
progress.value = 60;
separator.orientation = "vertical";
separator.decorative = true;
// @ts-expect-error Status is derived from the native image request.
avatar.status = "loaded";
// @ts-expect-error Native numeric setters require numbers in typed code.
meter.value = "45";
// @ts-expect-error Indeterminate progress is represented by omitting the value attribute.
progress.value = null;
// @ts-expect-error Position is derived from native progress semantics.
progress.position = 0.5;
// @ts-expect-error Orientation uses a closed vocabulary.
separator.orientation = "diagonal";
void [
	avatarConstructor,
	meterConstructor,
	progressConstructor,
	separatorConstructor,
	avatarStatus,
	progressStatus,
	orientation,
	image,
	nativeMeter,
	nativeProgress,
	rule,
	elements,
];
