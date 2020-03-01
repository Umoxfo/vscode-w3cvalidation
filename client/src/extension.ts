/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import { commands, env, ExtensionContext, Uri, window } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient";

import * as path from "path";
import { checkJava } from "./Java";
import { checkValidator } from "./service/vnu";
import * as Message from "./Message.json";

let client: LanguageClient;

export async function activate(context: ExtensionContext): Promise<void> {
    try {
        const JETTY_HOME = context.asAbsolutePath(path.join("server", "service", "jetty-home"));
        const JETTY_BASE = context.asAbsolutePath(path.join("server", "service", "vnu"));

        // Java and validator check
        await Promise.all([checkJava(), checkValidator(JETTY_HOME, JETTY_BASE)]);

        // The server is implemented in node
        const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));

        // If the extension is launched in debug mode then the debug server options are used,
        // otherwise the run options are used
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
            initializationOptions: [JETTY_HOME, JETTY_BASE],
            progressOnInitialization: true,
        };

        // Create the language client and start the client.
        client = new LanguageClient("w3cvalidation", "HTML Validation Service", serverOptions, clientOptions);
        client.start();
    } catch (error) {
        await window.showErrorMessage(Message.JavaMissingErrorText, Message.GetJavaButtonText);
        await env.openExternal(Uri.parse(Message.OracleJavaDownloadUrl));

        const item = await window.showInformationMessage(
            Message.JavaInstallInfoText,
            Message.UserSettingsButtonText,
            Message.WorkspaceSettingsButtonText
        );

        let commandID = "";
        switch (item) {
            case Message.UserSettingsButtonText:
                commandID = "workbench.action.openGlobalSettings";
                break;
            case Message.WorkspaceSettingsButtonText:
                commandID = "workbench.action.openWorkspaceSettings";
                break;
        }// switch

        await commands.executeCommand(commandID);
    }// try-catch
}

export const deactivate = (): Thenable<void> | undefined => client?.stop();
