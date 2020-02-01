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
    TextDocuments,
    TextDocumentSyncKind,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ChildProcess, spawn } from "child_process";
import * as util from "util";
const setTimeoutPromise = util.promisify(setTimeout);
import { sendDocument } from "./validator";

// Start a HTML validation server.
let validationService: ChildProcess;

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: IConnection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// After the server has started the client sends an initialize request.
connection.onInitialize((params: InitializeParams) => {
    const [JETTY_HOME, JETTY_BASE]: string = params.initializationOptions;

    // Start the validation server
    validationService = spawn("java", ["-jar", `${JETTY_HOME}/start.jar`], { cwd: JETTY_BASE });

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
        },
    };
});

// Shutdown the validation server.
connection.onShutdown((): void => validationService.kill("SIGINT"));

// The content of a text document has changed.
// eslint-disable-next-line @typescript-eslint/no-use-before-define
documents.onDidChangeContent(async (change): Promise<void> => await validateHtmlDocument(change.document));

// When a text document is closed, clear the error message.
documents.onDidClose((event): void => connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] }));

/*
 * Validation for HTML document
 */
async function validateHtmlDocument(textDocument: TextDocument): Promise<void> {
    try {
        const results = await sendDocument(textDocument);

        const diagnostics = results.map<Diagnostic>((item) => {
            let type: DiagnosticSeverity | undefined;
            switch (item.type) {
                case "info":
                    type = (item.subType === "warning") ? DiagnosticSeverity.Warning : DiagnosticSeverity.Information;
                    break;
                case "error":
                    type = DiagnosticSeverity.Error;
                    break;
            }// switch

            return {
                range: {
                    start: {
                        line: (item.firstLine || item.lastLine || 1) - 1,
                        character: (item.firstColumn || item.lastColumn || 1) - 1,
                    },
                    end: {
                        line: (item.lastLine ?? 1) - 1,
                        character: item.lastColumn ?? 0,
                    },
                },
                severity: type,
                source: "W3C Validator",
                message: item.message ?? "",
            };
        });

        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    } catch (error) {
        await setTimeoutPromise((Math.random() + 1) * 1000);
        validateHtmlDocument(textDocument);
    }// try-catch
}// validateHtmlDocument

// Make the text document manager listen on the connection for change text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
