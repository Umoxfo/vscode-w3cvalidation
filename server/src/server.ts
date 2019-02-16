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
connection.onInitialize(() => {
    const JETTY_HOME = path.resolve(__dirname, "../service/jetty-home");
    const JETTY_BASE = path.resolve(__dirname, "../service/vnu");

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
documents.onDidChangeContent((change) => validateHtmlDocument(change.document));

// When a text document is closed, clear the error message.
documents.onDidClose((event) => connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] }));

/*
 * Validation for HTML document
 */
function validateHtmlDocument(textDocument: TextDocument): void {
    const diagnostics: Diagnostic[] = [];

    sendDocument(textDocument).then((results) => {
        for (const item of results) {
            let type: DiagnosticSeverity;
            switch (item.type) {
                case "info":
                    if (item.subType === "warning") {
                        type = DiagnosticSeverity.Warning;
                    } else {
                        type = DiagnosticSeverity.Information;
                    }
                    break;
                case "error":
                    type = DiagnosticSeverity.Error;
                    break;
            }// switch

            diagnostics.push({
                range: {
                    start: {
                        line: (item.firstLine || item.lastLine) - 1,
                        character: item.firstColumn || (item.lastColumn - 1),
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
        }//forOf
    }).then(() => {
        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    }).catch(() => setTimeoutPromise((Math.random() + 1) * 1000).then(() => validateHtmlDocument(textDocument)));
}// validateHtmlDocument

// Make the text document manager listen on the connection for change text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
