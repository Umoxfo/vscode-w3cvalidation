import { workspace, languages, Uri } from "vscode";
import path from "path";

import type { DiagnosticSeverity } from "vscode";

const BASE_URL = (workspace.workspaceFolders ?? [])[0]?.uri ?? Uri.file(path.resolve(__dirname, "../resource"));

/**
 * Activates the Umoxfo.vscode-w3cvalidation extension
 */
export async function activate(fileName: string): Promise<DiagnosticSeverity | undefined> {
    const docUri = Uri.joinPath(BASE_URL, fileName);
    await workspace.openTextDocument(docUri);

    return new Promise((resolve) => {
        let count = 0;

        languages.onDidChangeDiagnostics(() => {
            const dig = languages.getDiagnostics(docUri);
            if (dig.length || ++count === 2) resolve(dig[0]?.severity);
        });
    });
}
