// Ambient global augmentation for the Symbol.metadata proposal, matching the
// runtime polyfill. Reference this file (or the `types` barrel) from your
// project's `vite-env.d.ts`:
//
//     /// <reference types="@serve-tools/vite-polyfills/types/symbol-metadata" />

import "@serve-tools/polyfill-decorator-metadata/apply/Symbol/metadata";
