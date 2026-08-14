/** Returns whether the current platform is macOS, iOS, or iPadOS. */
export const isApplePlatform = /iPad|iPhone|iPod|Mac/.test(navigator.platform);

/** Returns whether the current platform is Windows, Windows CE, or Windows Phone. */
export const isWindowsPlatform = !isApplePlatform && /^Win/.test(navigator.platform);
