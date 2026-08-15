# Present shortcuts

- Use `getKeyChordLabel` for accessible prose.
- Use `getKeyChordSymbols` for visual key presentation.
- Use `getKeyChordAriaKeyShortcuts` for the `aria-keyshortcuts` attribute.
- Use `modKey`, `auxKey`, `isApplePlatform`, and `isWindowsPlatform` when application behavior must follow the same conventions.
- Expect platform constants to be determined from `navigator.platform` when the module loads.
