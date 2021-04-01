import { window, workspace, languages, Uri } from "vscode";
import path from "path";

import type { DiagnosticSeverity } from "vscode";

const ROOT_PATH = workspace.workspaceFolders
    ? workspace.workspaceFolders[0]?.uri.fsPath
    : path.resolve(__dirname, "../resource");

/**
 * Activates the Umoxfo.vscode-w3cvalidation extension
 */
export async function activate(fileName: string): Promise<DiagnosticSeverity | undefined> {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
