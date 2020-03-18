import * as assert from "assert";
import { after } from "mocha";
import { getDocUri, activate } from "../helper";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";

async function testDiagnostic(docUri: vscode.Uri, severity?: vscode.DiagnosticSeverity): Promise<void> {
    await activate(docUri);

    assert.equal(vscode.languages.getDiagnostics(docUri)[0].severity, severity);
}

suite("Extension Test Suite", () => {
    test("Testing Passed HTML files", async () => assert.doesNotReject(activate(getDocUri("test.html"))));
    test("Testing Warning HTML files", async () =>
        await testDiagnostic(getDocUri("warning.html"), vscode.DiagnosticSeverity.Warning));
    test("Testing Error HTML file", async () =>
        await testDiagnostic(getDocUri("error.html"), vscode.DiagnosticSeverity.Error));

    after(async (done) => {
        await vscode.window.showInformationMessage("All tests done!");
        return setImmediate(done);
    });
});
