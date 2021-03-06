/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import { workspace } from "vscode";

import { execFile } from "child_process";
import { promisify } from "util";
const execFilePromise = promisify(execFile);
import path from "path";

if (process.platform === "darwin") {
    execFile("/usr/libexec/java_home", (_, stdout): string => (process.env["JAVA_HOME"] = stdout));
}

const javaDirectories: readonly (string | undefined)[] = [
    workspace.getConfiguration("vscode-w3cvalidation").get("javaHome"),
    process.env["JAVA_HOME"],
    process.env["JDK_HOME"],
];

for (const javadir of javaDirectories) {
    if (javadir) process.env["PATH"] += path.delimiter + path.join(javadir, "bin");
}

/**
 * Checks JRE version
 *
 * @returns Resolved promise
 */
export async function checkJava(): Promise<void> {
    const { stderr } = await execFilePromise("java", ["-version"]);
    const currentVersion = stderr.substring(stderr.indexOf('"') + 1, stderr.lastIndexOf('"'));

    return currentVersion >= "1.8" ? Promise.resolve() : Promise.reject();
}
