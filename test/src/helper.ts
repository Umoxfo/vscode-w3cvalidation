import * as vscode from "vscode";
import * as path from "path";
import { promisify } from "util";
const setTimeoutPromise = promisify(setTimeout);

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;
export let documentEol: string;
export let platformEol: string;

/**
 * Activates the Umoxfo.vscode-w3cvalidation extension
 */
export async function activate(docUri: vscode.Uri): Promise<void> {
    // The extensionId is `publisher.name` from package.json
    const ext = vscode.extensions.getExtension("Umoxfo.vscode-w3cvalidation");
    await ext?.activate();
    try {
        doc = await vscode.workspace.openTextDocument(docUri);
        editor = await vscode.window.showTextDocument(doc);

        // Wait for server activation
        await new Promise((c) => vscode.languages.onDidChangeDiagnostics(c));

        return new Promise((resolve, reject) => {
            vscode.languages.onDidChangeDiagnostics(() => resolve());
            setTimeoutPromise((Math.random() + 1) * 20000).then(reject);
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
    }
}

export const getDocPath = (p: string): string => path.resolve(__dirname, "../resource", p);
export const getDocUri = (p: string): vscode.Uri => vscode.Uri.file(getDocPath(p));
