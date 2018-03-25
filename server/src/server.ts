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
import * as http from "http";
import * as path from "path";
import { checkJRE } from "./JRE";

// Start a HTML validation server.
let validationService: ChildProcess;

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection: IConnection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager supports full document sync only
const documents: TextDocuments = new TextDocuments();

// After the server has started the client sends an initialize request.
// The server receives in the passed params the rootPath of the workspace plus the client capabilities.
// tslint:disable-next-line:variable-name
connection.onInitialize((_params: InitializeParams) => {
    const JETTY_HOME = path.resolve(__dirname, "../service/jetty-home");
    const JETTY_BASE = path.resolve(__dirname, "../service/vnu");

    /* Ready for the server */
    checkJRE().then(() => {
        validationService = spawn("java", ["-jar", `${JETTY_HOME}/start.jar`], { cwd: JETTY_BASE });
    });

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
        },
    };
});

// Shutdown the server.
connection.onShutdown(() => validationService.kill("SIGINT"));

// The content of a text document has changed.
// This event is emitted when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => validateHtmlDocument(change.document));

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

    checkValidation(textDocument.getText()).then((results) => {
        results.forEach((element) => {
            let type: DiagnosticSeverity;
            switch (element.type) {
                case "info":
                    if (element.subtype === "warning") {
                        type = DiagnosticSeverity.Warning;
                    } else {
                        type = DiagnosticSeverity.Information;
                    }
                    break;
                case "error":
                    type = DiagnosticSeverity.Error;
                    break;
            }// switch

            if (!element.firstLine) { element.firstLine = element.lastLine; }

            diagnostics.push({
                severity: type,
                range: {
                    start: {
                        line: element.firstLine - 1,
                        character: element.firstColumn,
                    },
                    end: {
                        line: element.lastLine - 1,
                        character: element.lastColumn,
                    },
                },
                message: element.message,
                source: "W3C Validator",
            });
        });
    }).then(() => {
        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({
            uri: textDocument.uri,
            diagnostics,
        });
    }).catch(() => {
        new Promise((resolve) => setTimeout(resolve, (Math.random() + 1) * 1000))
            .then(() => validateHtmlDocument(textDocument));
    });
}

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
function checkValidation(htmlDocument: string): Promise<ValidationResult[]> {
    return new Promise((resolve, reject) => {
        const request = http.request(RequestOptions, (response) => {
            // handle http errors
            if (response.statusCode < 200 || response.statusCode > 299) { reject(); }

            // temporary data holder
            let body = "";

            // on every content chunk, push it to the data array
            response.on("data", (chunk) => body += chunk);

            // we are done, resolve promise with those joined chunks
            response.on("end", () => resolve(JSON.parse(body).messages));
        });

        // handle connection errors of the request
        request.on("error", reject);

        // write data to request body
        request.write(htmlDocument);
        request.end();
    });
}

// Make the text document manager listen on the connection for change text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
