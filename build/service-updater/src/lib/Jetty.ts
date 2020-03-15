/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import { JSDOM } from "jsdom";
import * as tar from "tar";

import * as http2 from "http2";
import { Duplex } from "stream";
import * as zlib from "zlib";
import { promises as fs } from "fs";
import * as path from "path";
import { getArchive, getPlainText } from "./downloader";

// eslint-disable-next-line prettier/prettier
import type { OutgoingHttpHeaders, ClientHttp2Session, ClientHttp2Stream } from "http2";
interface ArchiveResponse { archive: Buffer, archiveHash: string }
type ResponseResolve = (value: string | ArchiveResponse) => void;
type ResponseFunction = (response: ClientHttp2Stream, resolve: ResponseResolve) => void;
type AssetDownloadTasks = [Promise<ArchiveResponse>, Promise<string>];

const MAVEN_CENTRAL_REPOSITORY = "https://repo1.maven.org";
const JETTY_VERSION_PATTERN = /(\d+\.){3}v\d+/;

let clientSession: ClientHttp2Session;

/**
 * @param {string} xmlDoc The maven-metadata.xml file of the Jetty-Home project
 * @returns The latest version string of Jetty-Home
 */
function parseXML(xmlDoc: string): string {
    const { document } = new JSDOM(xmlDoc, { contentType: "text/xml" }).window;

    const versions = Array.from(document.getElementsByTagName("version")).reverse();
    return versions.find(({ textContent }) => JETTY_VERSION_PATTERN.test(textContent ?? ""))?.textContent ?? "";
}

const preConfigReqOpts = (urlPath: string): OutgoingHttpHeaders => ({
    ":method": "GET",
    ":path": `/maven2/org/eclipse/jetty/jetty-home${urlPath}`,
    "User-Agent": "VSCode/umoxfo.vscode-w3cvalidation",
});

async function getLatestVersionInfo(): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = clientSession.request(preConfigReqOpts("/maven-metadata.xml"));

        req.setEncoding('utf8');
        let data = '';

        req.on('data', (chunk) => data += chunk);
        req.on('end', () => resolve(parseXML(data)));
        req.on("error", (err) => reject(err));

        req.end();
    });
}

async function downloadFile(reqOpts: OutgoingHttpHeaders, resFunc: ResponseFunction): Promise<string | ArchiveResponse> {
    return new Promise((resolve, reject) => {
        const req = clientSession.request(reqOpts);

        resFunc(req, resolve);

        req.on("error", (err) => reject(err));
        req.end();
    });
}

const JETTY_HOME = path.join(process.cwd(), "server", "service", "jetty-home");

async function installJetty(archive: Buffer, versionInfo: string): Promise<void> {
    const toStream = (buffer: Buffer): Duplex => {
        const stream = new Duplex();
        stream.push(buffer);
        stream.push(null);
        return stream;
    };

    await fs.rmdir(JETTY_HOME, { recursive: true });

    // Decompress data and write in a file
    const serverRootDir = path.join(process.cwd(), "server", "service");
    const originJettyPath = path.join(serverRootDir, `jetty-home-${versionInfo}`);

    return new Promise((resolve, reject) =>
        toStream(archive).pipe(zlib.createUnzip()).pipe(tar.extract({ cwd: serverRootDir }))
            .on("warn", (code: string, message: string, data: Error) => reject({ code, message, data }))
            .on("error", (err) => reject(err))
            .on("end", () => resolve(fs.rename(originJettyPath, JETTY_HOME)))
    );
}

const assets = [{ ext: ".tar.gz", func: getArchive }, { ext: ".tar.gz.sha1", func: getPlainText }];

/**
 * Download latest Jetty server
 */
async function downloadJetty(): Promise<{ archive: Buffer, versionInfo: string }> {
    const versionInfo = await getLatestVersionInfo();

    const [{ archive, archiveHash }, archiveChecksum] = await Promise.all(
        assets.map(async ({ ext, func }) =>
            downloadFile(preConfigReqOpts(`/${versionInfo}/jetty-home-${versionInfo}${ext}`), func)
        ) as AssetDownloadTasks
    );
    clientSession.close();

    if (archiveHash !== archiveChecksum) throw new Error("The downloaded file is invalid.");

    return { archive, versionInfo };
}

export async function updateJetty(): Promise<void> {
    clientSession = http2.connect(MAVEN_CENTRAL_REPOSITORY);
    try {
        const { archive, versionInfo } = await downloadJetty();
        return installJetty(archive, versionInfo);
    } finally {
        clientSession.close();
    }
}
