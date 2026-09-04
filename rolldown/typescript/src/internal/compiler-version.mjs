/** Stable 7.1 patch releases, plus all 7.1.0 pre-releases. */
export const compilerRange = "~7.1.0-0";

/** Match the supported npm peer range without depending on a general SemVer parser at runtime. */
export function supportsCompilerVersion(version) {
	return (
		typeof version === "string" &&
		/^7\.1\.(?:0(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
			version,
		)
	);
}
