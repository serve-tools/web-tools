# @serve-tools/client

The `@serve-tools/client` package provides namespaced access to the Serve Tools client libraries without flattening unrelated APIs into one export surface.

```ts
import { context, keyboard } from "@serve-tools/client";

const themeContext = context.createContext<"light" | "dark">(Symbol("theme"));
const saveChord = keyboard.getKeyChordLabel("Mod+S");
```

Each namespace is also available as a focused subpath:

```ts
import { createContext } from "@serve-tools/client/context";
import { getKeyChordLabel } from "@serve-tools/client/keyboard";
```

## Install

```shell
npm install @serve-tools/client
```

## Namespaces

| Namespace     | Focused subpath                   | Underlying package                |
| ------------- | --------------------------------- | --------------------------------- |
| `context`     | `@serve-tools/client/context`     | `@serve-tools/client-context`     |
| `db`          | `@serve-tools/client/db`          | `@serve-tools/client-db`          |
| `input`       | `@serve-tools/client/input`       | `@serve-tools/client-input`       |
| `interaction` | `@serve-tools/client/interaction` | `@serve-tools/client-interaction` |
| `keyboard`    | `@serve-tools/client/keyboard`    | `@serve-tools/client-keyboard`    |
| `messaging`   | `@serve-tools/client/messaging`   | `@serve-tools/client-messaging`   |
| `storage`     | `@serve-tools/client/storage`     | `@serve-tools/client-storage`     |

The root entrypoint exports namespaces rather than flattening their members, so similarly named operations retain their owning capability.
Use a focused subpath when only one capability is needed.

Input and interaction utilities retain their owning package's focused entrypoints:

```ts
import { observeDropTarget } from "@serve-tools/client/input/drop";
import { observePointer } from "@serve-tools/client/input/pointer";
import { writeToClipboard } from "@serve-tools/client/interaction/clipboard";
import { openEyeDropper } from "@serve-tools/client/interaction/eyedropper";
import { openFiles } from "@serve-tools/client/interaction/file-picker";
import { share } from "@serve-tools/client/interaction/share";
```

The `input` and `interaction` root namespaces and focused capability subpaths provide the same implementations.

Direct IndexedDB and SharedWorker-coordinated IndexedDB form one database entrypoint family:

```ts
import { DB } from "@serve-tools/client/db";
import { connect } from "@serve-tools/client/db/scope/window";
import { listen } from "@serve-tools/client/db/scope/shared-worker";
```

The root `db` namespace and focused `db` subpath provide direct, in-context IndexedDB operations.
The scoped entrypoints provide the narrower remote client and SharedWorker server APIs, including their shared database types.
They do not add transactions or scans across the message boundary.

Direct messaging and its worker-scope conveniences form one messaging entrypoint family:

```ts
import { connect, serve } from "@serve-tools/client/messaging";
import { SharedWorker } from "@serve-tools/client/messaging/scope/window";
import { listen } from "@serve-tools/client/messaging/scope/worker";
```

The window scope adds a typed `SharedWorker` convenience class and `connect` helper.
The worker scope adds `listen` for dedicated and shared worker globals.
Both scopes also re-export the messaging protocol types and transfer helper.

## Compatibility

This package is an ES module for the browser environments supported by its underlying client packages.
Importing the root entrypoint evaluates every namespace; focused subpaths let applications load a single capability directly.

## Agent Skill

This package includes `skills/serve-tools-client/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm test --workspace @serve-tools/client
```

## License

[MIT-0](./LICENSE.md)
