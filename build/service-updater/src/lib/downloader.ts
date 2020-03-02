/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import * as crypto from "crypto";

// eslint-disable-next-line prettier/prettier
import type { IncomingMessage } from "http";
import type { ClientHttp2Stream } from "http2";

type Response = IncomingMessage | ClientHttp2Stream;
export interface ArchiveResponse { archive: Buffer, archiveHash: string }

export function getArchive(response: Response, resolve: (value: ArchiveResponse) => void): void {
    const buffs: Buffer[] = [];
    const hash = crypto.createHash("sha1");

    response.on("data", (chunk) => {
        buffs.push(chunk);
        hash.update(chunk);
    });
    response.on("end", () => resolve({ archive: Buffer.concat(buffs), archiveHash: hash.digest("hex") }));
}

export function getPlainText(response: Response, resolve: (value: string) => void): void {
    response.setEncoding("utf-8");
    let body = "";

    response.on("data", (chunk) => (body += chunk));
    response.on("end", () => resolve(body));
}
