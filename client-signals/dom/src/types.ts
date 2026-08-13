import type * as htmltype from "@michijs/htmltype";

declare global {
	/** Type mappings shared by Signal DOM templates. */
	namespace DOM {
		/** Any HTML, MathML, or SVG element accepted by Signal DOM. */
		type Element = HTML.Element | MathML.Element | SVG.Element;

		namespace Element {
			/** Any HTML, MathML, or SVG tag name accepted by Signal DOM. */
			type Name = HTML.Element.Name | MathML.Element.Name | SVG.Element.Name;
		}

		/** The platform document type. */
		type Document = globalThis.Document;

		/** A document or shadow root that can adopt constructed stylesheets. */
		type Root = ShadowRoot | Document;

		/** The platform shadow-root type. */
		type ShadowRoot = globalThis.ShadowRoot;

		/** The attributes accepted for a specific HTML, MathML, or SVG element. */
		type AttributeSet<T> =
			| Related<T, DOM.HTML.Element, DOM.HTML.ElementMap, DOM.HTML.AttributeMap>
			| Related<T, DOM.MathML.Element, DOM.MathML.ElementMap, DOM.MathML.AttributeMap>
			| Related<T, DOM.SVG.Element, DOM.SVG.ElementMap, DOM.SVG.AttributeMap>;

		/** The writable properties accepted for a specific HTML, MathML, or SVG element. */
		type PropertySet<T> =
			| Related<T, DOM.HTML.Element, DOM.HTML.ElementMap, DOM.HTML.PropertyMap>
			| Related<T, DOM.MathML.Element, DOM.MathML.ElementMap, DOM.MathML.PropertyMap>
			| Related<T, DOM.SVG.Element, DOM.SVG.ElementMap, DOM.SVG.PropertyMap>;

		namespace HTML {
			/** HTML elements keyed by tag name. */
			interface ElementMap extends HTMLElementTagNameMap {}

			/** HTML attributes keyed by tag name. */
			interface AttributeMap extends htmltype.HTMLElements {}

			/** Writable HTML properties keyed by tag name. */
			interface PropertyMap extends PartialWritablePropertyMap<ElementMap> {}

			/** Any HTML element accepted by Signal DOM. */
			type Element = ElementMap[Element.Name];

			namespace Element {
				/** An HTML tag name accepted by Signal DOM. */
				type Name = keyof ElementMap;

				/** Writable element-internals properties accepted by `elementInternals()`. */
				type InternalsMap = Partial<ARIAMixin>;
			}
		}

		namespace MathML {
			/** MathML elements keyed by tag name. */
			interface ElementMap extends MathMLElementTagNameMap {}

			/** MathML attributes keyed by tag name. */
			interface AttributeMap extends htmltype.MathMLElements {}

			/** Writable MathML properties keyed by tag name. */
			interface PropertyMap extends PartialWritablePropertyMap<ElementMap> {}

			/** Any MathML element accepted by Signal DOM. */
			type Element = ElementMap[Element.Name];

			namespace Element {
				/** A MathML tag name accepted by Signal DOM. */
				type Name = keyof ElementMap;
			}
		}

		namespace SVG {
			/** SVG elements keyed by tag name. */
			interface ElementMap extends SVGElementTagNameMap {}

			/** SVG attributes keyed by tag name. */
			interface AttributeMap extends htmltype.SVGElements {}

			/** Writable SVG properties keyed by tag name. */
			interface PropertyMap extends PartialWritablePropertyMap<ElementMap> {}

			/** Any SVG element accepted by Signal DOM. */
			type Element = ElementMap[Element.Name];

			namespace Element {
				/** An SVG tag name accepted by Signal DOM. */
				type Name = keyof ElementMap;
			}
		}
	}
}

export { DOM };

// #region Internals

type Related<T, Element, ElementMap, RelatedMap> = T extends Element
	? {
			[K in keyof ElementMap]: ElementMap[K] extends T
				? K extends keyof RelatedMap
					? RelatedMap[K]
					: never
				: never;
		}[keyof ElementMap]
	: never;

type PartialWritable<T> = Partial<Pick<T, WritableKeys<T>>>;

type PartialWritablePropertyMap<T> = { [K in keyof T]: PartialWritable<T[K]> };

type WritableKeys<T> = {
	[K in keyof T]-?: IfEquals<{ [Q in K]: T[K] }, { -readonly [Q in K]: T[K] }, K>;
}[keyof T];

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;

// #endregion
