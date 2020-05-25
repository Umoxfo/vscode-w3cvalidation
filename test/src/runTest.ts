import * as path from "path";

import { runTests, downloadAndUnzipVSCode } from "vscode-test";

async function main(): Promise<void> {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, "../../../");

        // The path to the extension test runner script
        const extensionTestsPath = path.resolve(__dirname, "./suite/index");

        // The path to the executable VSCode
        const vscodeExecutablePath = await downloadAndUnzipVSCode("1.42.0");

        // Run the extension test
        await runTests({
            // Use the specified `code` executable
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: ["--disable-extensions", path.resolve(__dirname, "../resource")],
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        // eslint-disable-next-line no-console
        console.error("Failed to run tests");
        process.exit(1);
    }
}

void main();
