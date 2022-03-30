/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import { DOMParser } from "@xmldom/xmldom";
import tar from "tar";

import http2 from "http2";
const { HTTP2_HEADER_METHOD, HTTP2_HEADER_PATH, HTTP2_HEADER_USER_AGENT } = http2.constants;

import { Duplex } from "stream";
import zlib from "zlib";
import { promises as fs } from "fs";
import path from "path";
import { getArchive, getPlainText } from "./downloader";

import type { OutgoingHttpHeaders, ClientHttp2Session, ClientHttp2Stream } from "http2";
type ResponseFunc<T> = (response: ClientHttp2Stream, resolve: (value: T) => void) => void;

const MAVEN_CENTRAL_REPOSITORY = "https://repo1.maven.org";
const JETTY_VERSION_PATTERN = /(\d+\.){3}v\d+/;

const isLatestJetty = ({ firstChild }: Element): boolean => JETTY_VERSION_PATTERN.test(firstChild?.nodeValue ?? "");

let clientSession: ClientHttp2Session;

/**
 * @param {string} xmlDoc The maven-metadata.xml file of the Jetty-Home project
 * @returns The latest version string of Jetty-Home
 */
function parseXML(xmlDoc: string): string {
    const versions = new DOMParser().parseFromString(xmlDoc, "text/xml").getElementsByTagName("version");

    return Array.from(versions).reverse().find(isLatestJetty)?.firstChild?.nodeValue ?? "";
}

const preConfigReqOpts = (urlPath: string): OutgoingHttpHeaders => ({
    [HTTP2_HEADER_METHOD]: "GET",
    [HTTP2_HEADER_PATH]: `/maven2/org/eclipse/jetty/jetty-home/${urlPath}`,
    [HTTP2_HEADER_USER_AGENT]: "VSCode/umoxfo.vscode-w3cvalidation",
});

async function getLatestVersionInfo(): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = clientSession.request(preConfigReqOpts("maven-metadata.xml"));

        req.setEncoding("utf8");
        let data = "";

        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(parseXML(data)));
        req.on("error", (err) => reject(err));

        req.end();
    });
}

async function downloadFile<T>(reqOpts: OutgoingHttpHeaders, resFunc: ResponseFunc<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const req = clientSession.request(reqOpts);

        resFunc(req, resolve);

        req.on("error", (err) => reject(err));
        req.end();
    });
}

const serverRootDir = path.join(process.cwd(), "service");
const JETTY_HOME = path.join(serverRootDir, "jetty-home");

async function installJetty({ archive, versionInfo }: { archive: Buffer; versionInfo: string }): Promise<void> {
    const toStream = (buffer: Buffer): Duplex => {
        const stream = new Duplex();
        stream.push(buffer);
        stream.push(null);
        return stream;
    };

    await fs.rm(JETTY_HOME, { recursive: true });

    // Decompress data and write in a file
    const originJettyPath = path.join(serverRootDir, `jetty-home-${versionInfo}`);

    return new Promise((resolve, reject) =>
        toStream(archive)
            .pipe(zlib.createUnzip())
            .pipe(tar.extract({ cwd: serverRootDir }))
            .on("warn", (code: string, message: string, data: Error) => reject({ code, message, data }))
            .on("error", (err) => reject(err))
            .on("end", () => resolve(fs.rename(originJettyPath, JETTY_HOME)))
    );
}

/**
 * Download latest Jetty server
 */
async function downloadJetty(): Promise<{ archive: Buffer; versionInfo: string }> {
    const version = await getLatestVersionInfo();

    const [{ archive, archiveHash }, archiveChecksum] = await Promise.all([
        downloadFile(preConfigReqOpts(`${version}/jetty-home-${version}.tar.gz`), getArchive),
        downloadFile(preConfigReqOpts(`${version}/jetty-home-${version}.tar.gz.sha1`), getPlainText),
    ]);
    clientSession.close();

    if (archiveHash !== archiveChecksum) throw new Error("The downloaded file is invalid.");

    return { archive, versionInfo: version };
}

export async function updateJetty(): Promise<void> {
    clientSession = http2.connect(MAVEN_CENTRAL_REPOSITORY);
    try {
        return installJetty(await downloadJetty());
    } finally {
        clientSession.close();
    }
}
