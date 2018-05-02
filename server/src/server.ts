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
import * as http from "http";
import * as path from "path";

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

interface ValidationResult {
    type?: string;
    subtype?: string;
    message?: string;

    /*
     * The "firstLine", "firstColumn", "lastLine" and "lastColumn"
     * indicate a range of source code associated with the message.
     * The line and column numbers are one-based:
     *   The first line is line 1
     *   The first column is column 1
     */
    firstLine?: number; // If the attribute is missing, it is the same value as "lastLine".
    firstColumn?: number;
    lastLine?: number;
    lastColumn?: number;
}

/*
 * Validation for HTML document
 */
function validateHtmlDocument(textDocument: TextDocument): void {
    const diagnostics: Diagnostic[] = [];

    sendDocument(textDocument.getText()).then((results) => {
        results.forEach((item) => {
            let type: DiagnosticSeverity;
            switch (item.type) {
                case "info":
                    if (item.subtype === "warning") {
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
                        character: item.firstColumn,
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
        });
    }).then(() => {
        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    }).catch(() => {
        return new Promise((resolve) => setTimeout(resolve, (Math.random() + 1) * 1000))
            .then(() => validateHtmlDocument(textDocument));
    });
}// validateHtmlDocument

const RequestOptions: http.RequestOptions = {
    hostname: "localhost",
    port: 8888,
    path: "/?out=json",
    method: "POST",
    headers: {
        "Content-Type": "text/html; charset=utf-8",
        "User-Agent": "Validator.nu/LV",
    },
};

/*
 * Sends document to the local validation server
 */
function sendDocument(document: string): Promise<ValidationResult[]> {
    return new Promise((resolve, reject) => {
        const request = http.request(RequestOptions, (response) => {
            // handle http errors
            if (response.statusCode < 200 || response.statusCode > 299) { reject(); }

            // temporary data holder
            response.setEncoding("utf8");
            let body = "";

            // on every content chunk, push it to the data array
            response.on("data", (chunk) => body += chunk);

            // we are done, resolve promise with those joined chunks
            response.on("end", () => resolve(JSON.parse(body).messages));
        });

        // handle connection errors of the request
        request.on("error", (err) => reject(err));

        // write data to request body
        request.write(document);
        request.end();
    });
}// sendDocument

// Make the text document manager listen on the connection for change text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
