/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import { execFile } from "child_process";
import * as path from "path";

let javaBinDir: string = "bin";
if (process.platform === "darwin") {
    javaBinDir = "Contents/Home/bin";
}

const jreDir = path.join(__dirname, "jre");

process.env.PATH += path.join(path.delimiter, jreDir, javaBinDir);

/**
 * Checks JRE version
 *
 * @returns Thenable<{}> Resolved promise
 */
export function checkJRE(): Thenable<{}> {
    return new Promise((resolve, reject) => {
        // tslint:disable-next-line:variable-name
        execFile("java", ["-version"], (_error, _stdout, stderr) => {
            const currentVersion = stderr.substring(14, stderr.lastIndexOf("\""));

            (currentVersion >= "1.8") ? resolve() : reject();
        });
    });
}// checkJRE
