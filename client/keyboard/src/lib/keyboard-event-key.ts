/** Generated from the pinned W3C UI Events KeyboardEvent.key value tables. */
// Source: https://github.com/w3c/uievents-key/blob/140cae88d6039b3fb1a51787978678115111c433/index-source.txt
// Regenerate: npm run generate:keyboard-types --workspace @serve-tools/client-keyboard

/** Standardized named logical keyboard key values. */
export type KnownKeyboardEventKey =
	| KeyboardEventKey.General
	| KeyboardEventKey.Modifier
	| KeyboardEventKey.ModifierLegacy
	| KeyboardEventKey.Whitespace
	| KeyboardEventKey.Navigation
	| KeyboardEventKey.Editing
	| KeyboardEventKey.Ui
	| KeyboardEventKey.Device
	| KeyboardEventKey.Composition
	| KeyboardEventKey.ImeKorean
	| KeyboardEventKey.ImeJapanese
	| KeyboardEventKey.Function
	| KeyboardEventKey.Multimedia
	| KeyboardEventKey.MultimediaNumpad
	| KeyboardEventKey.Audio
	| KeyboardEventKey.Speech
	| KeyboardEventKey.Apps
	| KeyboardEventKey.Browser
	| KeyboardEventKey.MobilePhone
	| KeyboardEventKey.Tv
	| KeyboardEventKey.MediaController
	| KeyboardEventKey.MediaControllerDup;

/** Standardized named keys plus printable, international, and future browser key strings. */
export type KeyboardEventKey = KnownKeyboardEventKey | KeyboardEventKey.KeyString;

export namespace KeyboardEventKey {
	/** Any printable, international, or future browser key string. */
	export type KeyString = string & {};

	/** Standardized key values in the General category. */
	export type General = "Unidentified";

	/** Standardized key values in the Modifier category. */
	export type Modifier =
		| "Alt"
		| "AltGraph"
		| "CapsLock"
		| "Control"
		| "Fn"
		| "FnLock"
		| "Meta"
		| "NumLock"
		| "ScrollLock"
		| "Shift"
		| "Symbol"
		| "SymbolLock";

	/** Standardized key values in the ModifierLegacy category. */
	export type ModifierLegacy = "Hyper" | "Super";

	/** Standardized key values in the Whitespace category. */
	export type Whitespace = "Enter" | "Tab";

	/** Standardized key values in the Navigation category. */
	export type Navigation =
		| "ArrowDown"
		| "ArrowLeft"
		| "ArrowRight"
		| "ArrowUp"
		| "End"
		| "Home"
		| "PageDown"
		| "PageUp";

	/** Standardized key values in the Editing category. */
	export type Editing =
		| "Backspace"
		| "Clear"
		| "Copy"
		| "CrSel"
		| "Cut"
		| "Delete"
		| "EraseEof"
		| "ExSel"
		| "Insert"
		| "Paste"
		| "Redo"
		| "Undo";

	/** Standardized key values in the Ui category. */
	export type Ui =
		| "Accept"
		| "Again"
		| "Attn"
		| "Cancel"
		| "ContextMenu"
		| "Escape"
		| "Execute"
		| "Find"
		| "Help"
		| "Pause"
		| "Play"
		| "Props"
		| "Select"
		| "ZoomIn"
		| "ZoomOut";

	/** Standardized key values in the Device category. */
	export type Device =
		| "BrightnessDown"
		| "BrightnessUp"
		| "Eject"
		| "LogOff"
		| "Power"
		| "PowerOff"
		| "PrintScreen"
		| "Hibernate"
		| "Standby"
		| "WakeUp";

	/** Standardized key values in the Composition category. */
	export type Composition =
		| "AllCandidates"
		| "Alphanumeric"
		| "CodeInput"
		| "Compose"
		| "Convert"
		| "Dead"
		| "FinalMode"
		| "GroupFirst"
		| "GroupLast"
		| "GroupNext"
		| "GroupPrevious"
		| "ModeChange"
		| "NextCandidate"
		| "NonConvert"
		| "PreviousCandidate"
		| "Process"
		| "SingleCandidate";

	/** Standardized key values in the ImeKorean category. */
	export type ImeKorean = "HangulMode" | "HanjaMode" | "JunjaMode";

	/** Standardized key values in the ImeJapanese category. */
	export type ImeJapanese =
		| "Eisu"
		| "Hankaku"
		| "Hiragana"
		| "HiraganaKatakana"
		| "KanaMode"
		| "KanjiMode"
		| "Katakana"
		| "Romaji"
		| "Zenkaku"
		| "ZenkakuHankaku";

	/** Standardized key values in the Function category. */
	export type Function =
		| "F1"
		| "F2"
		| "F3"
		| "F4"
		| "F5"
		| "F6"
		| "F7"
		| "F8"
		| "F9"
		| "F10"
		| "F11"
		| "F12"
		| "F13"
		| "F14"
		| "F15"
		| "F16"
		| "F17"
		| "F18"
		| "F19"
		| "F20"
		| "F21"
		| "F22"
		| "F23"
		| "F24"
		| "Soft1"
		| "Soft2"
		| "Soft3"
		| "Soft4";

	/** Standardized key values in the Multimedia category. */
	export type Multimedia =
		| "ChannelDown"
		| "ChannelUp"
		| "Close"
		| "MailForward"
		| "MailReply"
		| "MailSend"
		| "MediaClose"
		| "MediaFastForward"
		| "MediaPause"
		| "MediaPlay"
		| "MediaPlayPause"
		| "MediaRecord"
		| "MediaRewind"
		| "MediaStop"
		| "MediaTrackNext"
		| "MediaTrackPrevious"
		| "New"
		| "Open"
		| "Print"
		| "Save"
		| "SpellCheck";

	/** Standardized key values in the MultimediaNumpad category. */
	export type MultimediaNumpad = "Key11" | "Key12";

	/** Standardized key values in the Audio category. */
	export type Audio =
		| "AudioBalanceLeft"
		| "AudioBalanceRight"
		| "AudioBassBoostDown"
		| "AudioBassBoostToggle"
		| "AudioBassBoostUp"
		| "AudioFaderFront"
		| "AudioFaderRear"
		| "AudioSurroundModeNext"
		| "AudioTrebleDown"
		| "AudioTrebleUp"
		| "AudioVolumeDown"
		| "AudioVolumeUp"
		| "AudioVolumeMute"
		| "MicrophoneToggle"
		| "MicrophoneVolumeDown"
		| "MicrophoneVolumeUp"
		| "MicrophoneVolumeMute";

	/** Standardized key values in the Speech category. */
	export type Speech = "SpeechCorrectionList" | "SpeechInputToggle";

	/** Standardized key values in the Apps category. */
	export type Apps =
		| "LaunchApplication1"
		| "LaunchApplication2"
		| "LaunchCalendar"
		| "LaunchContacts"
		| "LaunchMail"
		| "LaunchMediaPlayer"
		| "LaunchMusicPlayer"
		| "LaunchPhone"
		| "LaunchScreenSaver"
		| "LaunchSpreadsheet"
		| "LaunchWebBrowser"
		| "LaunchWebCam"
		| "LaunchWordProcessor";

	/** Standardized key values in the Browser category. */
	export type Browser =
		| "BrowserBack"
		| "BrowserFavorites"
		| "BrowserForward"
		| "BrowserHome"
		| "BrowserRefresh"
		| "BrowserSearch"
		| "BrowserStop";

	/** Standardized key values in the MobilePhone category. */
	export type MobilePhone =
		| "AppSwitch"
		| "Call"
		| "Camera"
		| "CameraFocus"
		| "EndCall"
		| "GoBack"
		| "GoHome"
		| "HeadsetHook"
		| "LastNumberRedial"
		| "Notification"
		| "MannerMode"
		| "VoiceDial";

	/** Standardized key values in the Tv category. */
	export type Tv =
		| "TV"
		| "TV3DMode"
		| "TVAntennaCable"
		| "TVAudioDescription"
		| "TVAudioDescriptionMixDown"
		| "TVAudioDescriptionMixUp"
		| "TVContentsMenu"
		| "TVDataService"
		| "TVInput"
		| "TVInputComponent1"
		| "TVInputComponent2"
		| "TVInputComposite1"
		| "TVInputComposite2"
		| "TVInputHDMI1"
		| "TVInputHDMI2"
		| "TVInputHDMI3"
		| "TVInputHDMI4"
		| "TVInputVGA1"
		| "TVMediaContext"
		| "TVNetwork"
		| "TVNumberEntry"
		| "TVPower"
		| "TVRadioService"
		| "TVSatellite"
		| "TVSatelliteBS"
		| "TVSatelliteCS"
		| "TVSatelliteToggle"
		| "TVTerrestrialAnalog"
		| "TVTerrestrialDigital"
		| "TVTimer";

	/** Standardized key values in the MediaController category. */
	export type MediaController =
		| "AVRInput"
		| "AVRPower"
		| "ColorF0Red"
		| "ColorF1Green"
		| "ColorF2Yellow"
		| "ColorF3Blue"
		| "ColorF4Grey"
		| "ColorF5Brown"
		| "ClosedCaptionToggle"
		| "Dimmer"
		| "DisplaySwap"
		| "DVR"
		| "Exit"
		| "FavoriteClear0"
		| "FavoriteClear1"
		| "FavoriteClear2"
		| "FavoriteClear3"
		| "FavoriteRecall0"
		| "FavoriteRecall1"
		| "FavoriteRecall2"
		| "FavoriteRecall3"
		| "FavoriteStore0"
		| "FavoriteStore1"
		| "FavoriteStore2"
		| "FavoriteStore3"
		| "Guide"
		| "GuideNextDay"
		| "GuidePreviousDay"
		| "Info"
		| "InstantReplay"
		| "Link"
		| "ListProgram"
		| "LiveContent"
		| "Lock"
		| "MediaApps"
		| "MediaAudioTrack"
		| "MediaLast"
		| "MediaSkipBackward"
		| "MediaSkipForward"
		| "MediaStepBackward"
		| "MediaStepForward"
		| "MediaTopMenu"
		| "NavigateIn"
		| "NavigateNext"
		| "NavigateOut"
		| "NavigatePrevious"
		| "NextFavoriteChannel"
		| "NextUserProfile"
		| "OnDemand"
		| "Pairing"
		| "PinPDown"
		| "PinPMove"
		| "PinPToggle"
		| "PinPUp"
		| "PlaySpeedDown"
		| "PlaySpeedReset"
		| "PlaySpeedUp"
		| "RandomToggle"
		| "RcLowBattery"
		| "RecordSpeedNext"
		| "RfBypass"
		| "ScanChannelsToggle"
		| "ScreenModeNext"
		| "Settings"
		| "SplitScreenToggle"
		| "STBInput"
		| "STBPower"
		| "Subtitle"
		| "Teletext"
		| "VideoModeNext"
		| "Wink"
		| "ZoomToggle";

	/** Standardized key values in the MediaControllerDup category. */
	export type MediaControllerDup =
		| "AudioVolumeDown"
		| "AudioVolumeUp"
		| "AudioVolumeMute"
		| "BrowserBack"
		| "BrowserForward"
		| "ChannelDown"
		| "ChannelUp"
		| "ContextMenu"
		| "Eject"
		| "End"
		| "Enter"
		| "Home"
		| "MediaFastForward"
		| "MediaPlay"
		| "MediaPlayPause"
		| "MediaRecord"
		| "MediaRewind"
		| "MediaStop"
		| "MediaPause"
		| "MediaTrackNext"
		| "MediaTrackPrevious"
		| "Power"
		| "Unidentified";
}
