import path from "path";

import { runTests } from "@vscode/test-electron";

const VSCODE_VERSION = "1.65.2";
// Use win64 instead of win32 for testing Windows
const platform = process.platform === "win32" ? "win32-x64-archive" : "win32-archive";

async function main(): Promise<void> {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, "../../../");

        // The path to the extension test runner script
        const extensionTestsPath = path.resolve(__dirname, "./suite/index");

        // Run the extension test
        await runTests({
            version: VSCODE_VERSION,
            platform,
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
