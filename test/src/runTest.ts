import path from "path";

import { runTests } from "vscode-test";

async function main(): Promise<void> {
    try {
        // Run the extension test
        await runTests({
            version: "1.55.0",
            // Use win64 instead of win32 for testing Windows
            platform: process.platform === "win32" ? "win32-x64-archive" : undefined,
            // The folder containing the Extension Manifest package.json
            extensionDevelopmentPath: path.resolve(__dirname, "../../../"),
            // The path to the extension test runner script
            extensionTestsPath: path.resolve(__dirname, "./suite/index"),
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
