# Choose the focused capability

1. Import from the package root when several one-shot interaction APIs are needed.
2. Prefer `./clipboard`, `./share`, `./eyedropper`, or `./file-picker` for one capability.
3. Use these helpers in browser windows; they depend on `navigator`, native UI, or the document.
