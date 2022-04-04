import { runTests } from "@vscode/test-electron";

import path from "path";

const VSCODE_VERSION = "1.65.2";

async function main(): Promise<void> {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, "../../");

        // The path to the extension test runner script
        const extensionTestsPath = path.resolve(__dirname, "./suite/index");

        // Run the extension test
        await runTests({
            version: VSCODE_VERSION,
            // Use win64 instead of win32 for testing Windows
            platform: getPlatform(),
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: ["--disable-extensions", path.resolve(__dirname, "../resource")],
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    }

    function getPlatform() {
        switch (process.platform) {
            case "win32":
                return "win32-x64-archive";
            case "darwin":
                return "darwin";
            case "linux":
                return "linux-x64";
            default:
                return "";
        }
    }
}

void main();
