import assert from "node:assert/strict";
import test from "node:test";
import { createReleasePlan, loadSemver } from "./release-plan.mjs";

const { satisfies, valid } = loadSemver();

function packageData(name, version, dependencies = {}) {
	return { location: name.slice(1).replace("/", "-"), manifest: { name, version, dependencies } };
}

test("single-package releases preserve exact-version confirmation", () => {
	const packages = [packageData("@serve-tools/a", "1.2.3")];
	const publishedVersions = new Map([["@serve-tools/a", ["1.2.2"]]]);

	assert.deepEqual(
		createReleasePlan({
			packages,
			publishedVersions,
			selector: "@serve-tools/a",
			requestedVersion: "1.2.3",
			satisfies,
			valid,
		}),
		[{ name: "@serve-tools/a", version: "1.2.3", path: "serve-tools-a" }],
	);
	assert.throws(
		() =>
			createReleasePlan({
				packages,
				publishedVersions,
				selector: "@serve-tools/a",
				requestedVersion: "1.2.2",
				satisfies,
				valid,
			}),
		/Expected @serve-tools\/a@1\.2\.3/,
	);
});

test("all selects unpublished versions and orders dependencies first", () => {
	const packages = [
		packageData("@serve-tools/application", "2.0.0", { "@serve-tools/runtime": "^2.0.0" }),
		packageData("@serve-tools/unchanged", "1.0.0"),
		packageData("@serve-tools/runtime", "2.0.0"),
	];
	const publishedVersions = new Map([
		["@serve-tools/application", ["1.0.0"]],
		["@serve-tools/unchanged", ["1.0.0"]],
		["@serve-tools/runtime", ["1.0.0"]],
	]);

	assert.deepEqual(
		createReleasePlan({ packages, publishedVersions, selector: "all", requestedVersion: "", satisfies, valid }),
		[
			{ name: "@serve-tools/runtime", version: "2.0.0", path: "serve-tools-runtime" },
			{ name: "@serve-tools/application", version: "2.0.0", path: "serve-tools-application" },
		],
	);
});

test("release planning rejects unavailable internal ranges before verification", () => {
	const packages = [
		packageData("@serve-tools/application", "2.0.0", { "@serve-tools/runtime": "^2.0.0" }),
		packageData("@serve-tools/runtime", "1.0.0"),
	];
	const publishedVersions = new Map([
		["@serve-tools/application", []],
		["@serve-tools/runtime", ["1.0.0"]],
	]);

	assert.throws(
		() =>
			createReleasePlan({ packages, publishedVersions, selector: "all", requestedVersion: "", satisfies, valid }),
		/@serve-tools\/application requires unavailable @serve-tools\/runtime@\^2\.0\.0/,
	);
});

test("single-package releases reject an already-published exact version", () => {
	const packages = [packageData("@serve-tools/a", "1.2.3")];
	const publishedVersions = new Map([["@serve-tools/a", ["1.2.3"]]]);

	assert.throws(
		() =>
			createReleasePlan({
				packages,
				publishedVersions,
				selector: "@serve-tools/a",
				requestedVersion: "1.2.3",
				satisfies,
				valid,
			}),
		/@serve-tools\/a@1\.2\.3 is already published/,
	);
});

test("release planning rejects internal dependency cycles", () => {
	const packages = [
		packageData("@serve-tools/a", "1.0.0", { "@serve-tools/b": "^1.0.0" }),
		packageData("@serve-tools/b", "1.0.0", { "@serve-tools/a": "^1.0.0" }),
	];
	const publishedVersions = new Map([
		["@serve-tools/a", []],
		["@serve-tools/b", []],
	]);

	assert.throws(
		() =>
			createReleasePlan({ packages, publishedVersions, selector: "all", requestedVersion: "", satisfies, valid }),
		/Internal release dependency cycle/,
	);
});
