/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import {
    createConnection,
    DiagnosticSeverity,
    ProposedFeatures,
    TextDocuments,
    TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { promisify } from "util";
const setTimeoutPromise = promisify(setTimeout);
import { sendDocument } from "./validator";

import type { Diagnostic } from "vscode-languageserver/node";
import type { Message } from "./validator";

// Create a connection for the server. The connection uses Node's IPC as a transport
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// After the server has started the client sends an initialize request.
connection.onInitialize(() => ({
    capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
    },
}));

// Make the text document manager listen on the connection for change text document events
documents.listen(connection);

// Shutdown the validation server.
// connection.onShutdown(() => {});

/*
 * Validation for HTML document
 */
async function validateHtmlDocument(textDocument: TextDocument): Promise<void> {
    try {
        const results = await sendDocument(textDocument.getText());

        const diagnostics = results.map<Diagnostic>((item) => ({
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
            severity: getSeverityLevel(item),
            source: "W3C Validator",
            message: item.message ?? "",
        }));

        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    } catch (error) {
        await setTimeoutPromise((Math.random() + 1) * 1000);
        await validateHtmlDocument(textDocument);
    }

    function getSeverityLevel(item: Message): DiagnosticSeverity {
        switch (item.type) {
            case "info":
                return item.subType === "warning" ? DiagnosticSeverity.Warning : DiagnosticSeverity.Information;
            case "error":
                return DiagnosticSeverity.Error;
            default:
                return DiagnosticSeverity.Hint;
        }
    }
}

// The content of a text document has changed.
documents.onDidChangeContent(async (change): Promise<void> => await validateHtmlDocument(change.document));

// When a text document is closed, clear the error message.
documents.onDidClose((event): void => connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] }));

// Listen on the connection
connection.listen();
