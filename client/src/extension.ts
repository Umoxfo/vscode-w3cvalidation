/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import { ExtensionContext } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient";

import * as path from "path";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: ["--nolazy", "--inspect=6009"] },
        },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for HTML documents
        documentSelector: [{ language: "html" }],
    };

    // Create the language client and start the client.
    client = new LanguageClient("w3cvalidation", "HTML Validation Service", serverOptions, clientOptions);
    client.registerProposedFeatures();
    client.start();
}

export function deactivate(): Thenable<void> {
    if (!client) { return Promise.resolve(); }

    return client.stop();
}
