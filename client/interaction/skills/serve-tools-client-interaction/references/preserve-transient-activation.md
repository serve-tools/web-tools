# Preserve transient activation

- Call `writeToClipboard` directly from the initiating gesture.
  Pass strings, blobs, or promises as representations; do not await promised clipboard data before calling it.
- Pass only resolved native `ShareData` to `share`.
  Prepare asynchronous data before the user gesture because Web Share cannot defer payload representations.
- Call `share`, `openEyeDropper`, and `openFiles` from the user action that authorizes them.
