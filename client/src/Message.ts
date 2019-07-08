/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

export const enum Message {
    JavaMissingErrorText = "Java runtime could not be located.",
    GetJavaButtonText = "Get Java Platform (JDK)",
    OracleJavaDownloadUrl = "http://www.oracle.com/technetwork/java/javase/downloads/index.html",
    // tslint:disable-next-line: max-line-length
    JavaInstallInfoText = "Install it and set its location using 'vscode-w3cvalidation.javaHome' variable in VS Code settings.",
    UserSettingsButtonText = "Open User Settings",
    WorkspaceSettingsButtonText = "Open Workspace Settings",
}
