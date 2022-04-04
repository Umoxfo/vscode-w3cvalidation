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

const JAVA_VERSION_STRING_FORMAT = /\d+\.\d+\.\d+/g;

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
    const { stdout } = await execFilePromise("java", ["--version"]);
    const versions = stdout?.match(JAVA_VERSION_STRING_FORMAT);

    let curVer;
    return versions && (curVer = versions[0]) && curVer >= "17" ? Promise.resolve() : Promise.reject();
}
