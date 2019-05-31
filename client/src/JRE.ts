/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import { workspace } from "vscode";

import { execFile } from "child_process";
import * as path from "path";
import * as util from "util";
const execFilePromise = util.promisify(execFile);

if (process.platform === "darwin") {
    execFile("/usr/libexec/java_home", (_, stdout) => process.env.JAVA_HOME = stdout);
}// if

const userJavaHome: string | undefined = workspace.getConfiguration("vscode-w3cvalidation").get("javaHome");
if (userJavaHome) {
    process.env.PATH += path.join(path.delimiter, userJavaHome, "bin");
}

const javaHome = process.env.JAVA_HOME;
if (javaHome) {
    process.env.PATH += path.join(path.delimiter, javaHome, "bin");
}

const jdkHome = process.env.JDK_HOME;
if (jdkHome) {
    process.env.PATH += path.join(path.delimiter, jdkHome, "bin");
}

/**
 * Checks JRE version
 *
 * @returns Promise<void> Resolved promise
 */
export async function checkJRE(): Promise<void> {
    const output = await execFilePromise("java", ["-version"]);
    const currentVersion = output.stderr.substring(14, output.stderr.lastIndexOf("\""));

    return (currentVersion >= "1.8") ? Promise.resolve() : Promise.reject();
}// checkJRE
