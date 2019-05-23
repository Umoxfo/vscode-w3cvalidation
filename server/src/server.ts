/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import {
    createConnection,
    Diagnostic,
    DiagnosticSeverity,
    IConnection,
    InitializeParams,
    ProposedFeatures,
    TextDocument,
    TextDocuments,
} from "vscode-languageserver";

import { ChildProcess, spawn } from "child_process";
import * as path from "path";
import * as util from "util";
const setTimeoutPromise = util.promisify(setTimeout);
import { sendDocument } from "./validator";

// Start a HTML validation server.
let validationService: ChildProcess;

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: IConnection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments = new TextDocuments();

// After the server has started the client sends an initialize request.
connection.onInitialize((params: InitializeParams) => {
    const extentionPath: string = params.initializationOptions;

    const JETTY_HOME = path.resolve(extentionPath, "server/service/jetty-home");
    const JETTY_BASE = path.resolve(extentionPath, "server/service/vnu");

    // Start the validation server
    validationService = spawn("java", ["-jar", `${JETTY_HOME}/start.jar`], { cwd: JETTY_BASE });

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
        },
    };
});

// Shutdown the validation server.
connection.onShutdown(() => validationService.kill("SIGINT"));

// The content of a text document has changed.
// eslint-disable-next-line @typescript-eslint/no-use-before-define
documents.onDidChangeContent(async (change) => await validateHtmlDocument(change.document));

// When a text document is closed, clear the error message.
documents.onDidClose((event) => connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] }));

/*
 * Validation for HTML document
 */
async function validateHtmlDocument(textDocument: TextDocument): Promise<void> {
    const diagnostics: Diagnostic[] = [];

    try {
        const results = await sendDocument(textDocument);

        for (const item of results) {
            let type: DiagnosticSeverity;
            switch (item.type) {
                case "info":
                    type = (item.subType === "warning") ? DiagnosticSeverity.Warning : DiagnosticSeverity.Information;
                    break;
                case "error":
                    type = DiagnosticSeverity.Error;
                    break;
            }// switch

            /* tslint:disable:object-literal-sort-keys */
            diagnostics.push({
                range: {
                    start: {
                        line: (item.firstLine || item.lastLine) - 1,
                        character: (item.firstColumn || item.lastColumn) - 1,
                    },
                    end: {
                        line: item.lastLine - 1,
                        character: item.lastColumn,
                    },
                },
                severity: type,
                source: "W3C Validator",
                message: item.message,
            });
            /* tslint:enable:object-literal-sort-keys */
        }// forOf

        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    } catch (error) {
        await setTimeoutPromise((Math.random() + 1) * 1000);
        return validateHtmlDocument(textDocument);
    }// try-catch
}// validateHtmlDocument

// Make the text document manager listen on the connection for change text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
