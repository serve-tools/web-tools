# `@serve-tools/client-context`

Interoperable context events, providers, consumers, and late-registration coordination for web components.
The package implements the [Web Components Community Group Context Protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md) in author code without modifying `Element.prototype`.

## Install

```shell
npm install @serve-tools/client-context
```

## Create a context

`createContext()` returns its key unchanged while associating the key with a value type in TypeScript.
Strict equality selects providers, so use a unique symbol or object for private identity and `Symbol.for()` or a string for intentionally shared identity.

```ts
import { createContext } from "@serve-tools/client-context";

interface Theme {
	name: string;
}

export const themeContext = createContext<Theme>(Symbol("theme"));
```

## Provide a value

`ContextProvider` installs non-capturing event listeners when connected and removes them when disconnected.
Connecting announces the provider, and disconnecting gives live subscriptions a chance to fall back to another matching ancestor.

```ts
import { ContextProvider } from "@serve-tools/client-context";
import { themeContext } from "./theme-context.js";

class ThemeProvider extends HTMLElement {
	readonly #provider = new ContextProvider(this, {
		context: themeContext,
		initialValue: { name: "light" },
	});

	connectedCallback() {
		this.#provider.connect();
	}

	disconnectedCallback() {
		this.#provider.disconnect();
	}

	set theme(value) {
		this.#provider.setValue(value);
	}
}
```

The nearest matching provider stops immediate propagation before delivery.
Subscriptions are identified by the context, consumer, and callback rather than callback alone.
Updates snapshot registrations and isolate callback failures so one consumer cannot block another.

## Consume a value

`ContextConsumer` owns one request lifecycle and invokes callbacks with the consumer element as `this`.
A subscribing miss is indexed by context at a shared document root and replayed when a matching provider announces itself.

```ts
import { ContextConsumer } from "@serve-tools/client-context";
import { themeContext } from "./theme-context.js";

class ThemeConsumer extends HTMLElement {
	readonly #consumer = new ContextConsumer(this, {
		context: themeContext,
		subscribe: true,
		callback(theme) {
			this.dataset.theme = theme.name;
		},
	});

	connectedCallback() {
		this.#consumer.connect();
	}

	disconnectedCallback() {
		this.#consumer.disconnect();
	}

	connectedMoveCallback() {
		this.#consumer.refresh();
	}
}
```

`disconnect()` deterministically removes either the pending miss or current subscription.
`refresh()` cancels and reissues the request after a state-preserving move or another topology change that does not run ordinary connection callbacks.
The consumer records a replacement unsubscribe function before releasing its previous provider, so reentrant cleanup cannot overwrite the new subscription.

## Coordinate independent implementations

Connecting a subscribing `ContextConsumer` installs one shared `ContextRoot` on its document before the request is dispatched.
Create and attach a `ContextRoot` explicitly near application startup when independently implemented consumers, including Lit consumers, must also survive provider-late registration.

```ts
import { ContextRoot } from "@serve-tools/client-context";

const root = new ContextRoot(document);
```

The root retains only unanswered subscribing requests.
It uses weak references for iterable pending records, supports deterministic cancellation for owned consumers, and indexes announcements by context instead of scanning unrelated requests.
It does not use a `MutationObserver`; provider announcements and explicit consumer refreshes are the invalidation boundary.

Call `root.destroy()` when an explicitly created root no longer belongs to the application.
Do not install overlapping roots unless their lifetimes are coordinated, because independent roots can each retain the same missed request.

## Structural interoperability

`ContextRequestEvent` and `ContextProviderEvent` are author-code event classes with the positional constructor shape used by the existing Lit context package.
Providers qualify events by name, propagation flags, dispatching element, and properties rather than by class identity.
Components using independent compatible event classes therefore interoperate without depending on this package.

Context requests are synchronous event dispatches.
Only subscribing misses are retained by `ContextRoot`; a one-time miss ends when dispatch returns.

## Demo

The [`demo`](./demo) workspace demonstrates a subscribing consumer moving between live providers:

[Try the demo in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/client/context/demo)

The demo directory is standalone-importable and installs the published package when it is used outside this repository.
To run it against the local workspace package instead:

```shell
npm run build --workspace @serve-tools/client-context
npm run dev --workspace @serve-tools/client-context-demo
```
