import { DefaultReporter, type UserConsoleLog } from "vitest/node";

/** Prints benchmark records while retaining Vitest's default run summary. */
export default class BenchmarkReporter extends DefaultReporter {
	override onUserConsoleLog(log: UserConsoleLog): void {
		if (log.content.startsWith("[benchmark]")) process.stdout.write(`${log.content}\n`);
		else super.onUserConsoleLog(log);
	}
}
