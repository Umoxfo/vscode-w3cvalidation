/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import { execFile } from "child_process";
import * as path from "path";
import * as request from "request";
import * as tar from "tar-fs";
import * as zlib from "zlib";

import { JRE } from "./dependency.json";

let platform: string;
let javaBinDir: string = "bin";
switch (process.platform) {
    case "darwin":
        platform = "macosx";
        javaBinDir = "Contents/Home/bin";
        break;
    case "win32":
        platform = "windows";
        break;
    case "linux": break;
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
            const currentVersion = stderr.substring(14, stderr.lastIndexOf('"'));

            (currentVersion >= JRE.version) ? resolve() : reject();
        });
    }).catch(() => install());
}// checkJRE

function install() {
    let arch: string;
    switch (process.arch) {
        case "x64": break;
        case "x86":
        case "ia32":
            arch = "i586";
            break;
    }

    const options = {
        // tslint:disable-next-line:max-line-length
        url: `https://download.oracle.com/otn-pub/java/jdk/${JRE.product_version}-b${JRE.build_number}/${JRE.hash}/jre-${JRE.product_version}-${platform}-${arch}.tar.gz`,
        rejectUnauthorized: false,
        headers: {
            connection: "keep-alive",
            Cookie: "gpw_e24=http://www.oracle.com/; oraclelicense=accept-securebackup-cookie",
        },
    };

    return new Promise((resolve, reject) => {
        request.get(options)
            .on("error", reject)
            .pipe(zlib.createUnzip())
            .pipe(tar.extract(jreDir, {
                map: (header) => {
                    header.name = header.name.replace(/.*?\//, "");
                    return header;
                },
                readable: true,
                writable: true,
            }))
            .on("finish", resolve);
    });
}// install