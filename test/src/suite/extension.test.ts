import { strict as assert } from "assert";
import { before } from "mocha";
import { activate } from "../helper";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { DiagnosticSeverity, extensions } from "vscode";

async function testDiagnostic(fileName: string, severity?: DiagnosticSeverity): Promise<void> {
    const res = await activate(fileName);

    assert.equal(res, severity);
}

suite("Extension Test Suite", () => {
    before(async () => {
        const ext = extensions.getExtension("Umoxfo.vscode-w3cvalidation");
        if (!ext) assert.fail("Extension not found.");

        await ext.activate();
    });

    test("Testing Passed HTML files", async () => testDiagnostic("test.html", undefined));
    test("Testing Warning HTML files", async () => testDiagnostic("warning.html", DiagnosticSeverity.Warning));
    test("Testing Error HTML file", async () => testDiagnostic("error.html", DiagnosticSeverity.Error));
});
