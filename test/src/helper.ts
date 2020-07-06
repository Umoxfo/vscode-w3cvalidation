import { window, workspace, languages, Uri, DiagnosticSeverity } from "vscode";
import * as path from "path";

const ROOT_PATH = workspace.workspaceFolders
    ? workspace.workspaceFolders[0].uri.fsPath
    : path.resolve(__dirname, "../resource");

/**
 * Activates the Umoxfo.vscode-w3cvalidation extension
 */
export async function activate(fileName: string): Promise<DiagnosticSeverity | undefined> {
    const docUri = Uri.file(`${ROOT_PATH}/${fileName}`);
    await window.showTextDocument(docUri);

    return new Promise((resolve) => {
        let count = 0;

        languages.onDidChangeDiagnostics(() => {
            const dig = languages.getDiagnostics(docUri);
            if (dig.length || ++count === 2) resolve(dig[0]?.severity);
        });
    });
}
