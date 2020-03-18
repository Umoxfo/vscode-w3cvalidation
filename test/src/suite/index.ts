import * as path from "path";
import { promisify } from "util";
import Mocha from "mocha";
import glob from "glob";
const globPromise = promisify(glob);

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({ ui: "tdd", color: true, timeout: (Math.random() + 1) * 20000 });

    const testsRoot = path.resolve(__dirname, "..");

    const files = await globPromise("**/**.test.js", { cwd: testsRoot });

    return new Promise((c, e) => {
        files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

        // Run the mocha test
        mocha.run((failures) => {
            if (failures > 0) {
                e(new Error(`${failures} tests failed.`));
            } else {
                c();
            }
        });
    });
}
