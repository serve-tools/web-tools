// Ambient global augmentations for Observable, Subscriber, and
// EventTarget.prototype.when, matching the runtime polyfills. Reference this
// file (or the `types` barrel) from your project's `vite-env.d.ts`:
//
//     /// <reference types="@serve-tools/vite-polyfills/types/observable" />

import "@serve-tools/polyfill-observable/apply/Observable";
import "@serve-tools/polyfill-observable/apply/Subscriber";
import "@serve-tools/polyfill-observable/apply/EventTarget/when";
