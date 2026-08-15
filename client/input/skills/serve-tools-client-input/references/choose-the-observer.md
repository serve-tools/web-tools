# Choose the observer

1. Use `observePointer` for consecutive single-pointer sessions on an element.
2. Use `observeDropTarget` for normalized drag sessions over an element, document, shadow root, or window.
3. Import from the package root when both observers are needed, or from `./pointer` or `./drop` for one capability.
