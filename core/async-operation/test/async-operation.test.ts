import { describe, test } from "vitest";

import {
	testAlreadyAbortedUpstreamSignal,
	testBackpressure,
	testBufferedCompletionDoesNotRequireConsumption,
	testCompletedIterationSurvivesDisposal,
	testDemoOperation,
	testDisposalReleasesAnUnconsumedWrite,
	testDisposalWaitsForProducer,
	testExecutorCannotReturnWithPendingWrites,
	testExplicitAbort,
	testIterationCancellation,
	testProducerFailure,
	testSuccessfulOperation,
	testUpstreamAbort,
} from "./.shared.js";

describe("AsyncOperation", () => {
	test("README example", testDemoOperation);
	test("delivers ordered values and one terminal result", testSuccessfulOperation);
	test("preserves clean completion during scope disposal", testCompletedIterationSurvivesDisposal);
	test("preserves producer failure identity", testProducerFailure);
	test("owns cancellation of its value iteration", testIterationCancellation);
	test("does not start with an already-aborted upstream signal", testAlreadyAbortedUpstreamSignal);
	test("composes upstream cancellation into its owned signal", testUpstreamAbort);
	test("applies stream backpressure", testBackpressure);
	test("closes with buffered values before a consumer attaches", testBufferedCompletionDoesNotRequireConsumption);
	test("rejects an executor return with unsettled writes", testExecutorCannotReturnWithPendingWrites);
	test("supports explicit cancellation", testExplicitAbort);
	test("waits for producer cleanup during disposal", testDisposalWaitsForProducer);
	test("disposal releases a write blocked without a consumer", testDisposalReleasesAnUnconsumedWrite);
});
