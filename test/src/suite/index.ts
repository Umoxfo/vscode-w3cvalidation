import path from "path";
import { promises as fs } from "fs";
import Mocha from "mocha";

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({ ui: "tdd", color: true, timeout: "30s" });

    for (const file of await fs.readdir(__dirname)) {
        if (file.endsWith(".test.js")) mocha.addFile(path.join(__dirname, file));
    }

    // Run the mocha test
    return new Promise((c, e) =>
        mocha.run((failures) => (failures > 0 ? e(new Error(`${failures} tests failed.`)) : c()))
    );
}
