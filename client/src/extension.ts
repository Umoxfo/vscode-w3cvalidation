/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import { env, ExtensionContext, Uri, window } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient";

import * as path from "path";
import { checkJRE } from "./JRE";

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
    try {
        // JRE check
        await checkJRE();

        // The server is implemented in node
        const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));

        // If the extension is launched in debug mode then the debug server options are used
        // Otherwise the run options are used
        /* tslint:disable:object-literal-sort-keys */
        const serverOptions: ServerOptions = {
            run: { module: serverModule, transport: TransportKind.ipc },
            debug: {
                module: serverModule,
                transport: TransportKind.ipc,
                options: { execArgv: ["--nolazy", "--inspect=6009"] },
            },
        };
        /* tslint:enable:object-literal-sort-keys */

        // Options to control the language client
        const clientOptions: LanguageClientOptions = {
            // Register the server for HTML, CSS, SVG documents
            documentSelector: [{ language: "html" }, /* { language: "css" }, */ { language: "svg" }],
            initializationOptions: context.extensionPath,
        };

        // Create the language client and start the client.
        client = new LanguageClient("w3cvalidation", "HTML Validation Service", serverOptions, clientOptions);
        client.start();
    } catch (error) {
        window.showErrorMessage("Java runtime could not be located.", "Get Java Platform (JDK)")
            .then(async () => {
                await env.openExternal(Uri.parse("http://www.oracle.com/technetwork/java/javase/downloads/index.html"));
            });

        // tslint:disable-next-line:max-line-length
        window.showInformationMessage("Install it and set its location using 'vscode-w3cvalidation.javaHome' variable in VS Code settings.");
    }// try-catch
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) { return undefined; }

    return client.stop();
}
