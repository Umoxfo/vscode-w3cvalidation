/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import { workspace, ConfigurationTarget } from "vscode";

import http2 from "http2";
/* eslint-disable prettier/prettier */
const {
    HTTP2_HEADER_METHOD,
    HTTP2_HEADER_PATH,
    HTTP2_HEADER_USER_AGENT,
    HTTP2_HEADER_IF_MODIFIED_SINCE,
    HTTP_STATUS_NOT_MODIFIED
} = http2.constants;
/* eslint-enable prettier/prettier */

import https from "https";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
const execFilePromise = promisify(execFile);

import type { OutgoingHttpHeaders, ClientHttp2Session } from "http2";
import type { IncomingMessage } from "http";
import type { ChildProcessWithoutNullStreams } from "child_process";

const files: readonly string[] = ["vnu.war", "vnu.war.sha1"];

const RequestOptions: OutgoingHttpHeaders = {
    [HTTP2_HEADER_METHOD]: "HEAD",
    [HTTP2_HEADER_PATH]: "/repos/validator/validator/releases/tags/latest",
    [HTTP2_HEADER_USER_AGENT]: "VSCode/umoxfo.vscode-w3cvalidation",
    [HTTP2_HEADER_IF_MODIFIED_SINCE]: workspace.getConfiguration("vscode-w3cvalidation").get("validator-token"),
};

async function getLatestVersionInfo(): Promise<{ status: number; token: string | undefined }> {
    const clientSession = http2.connect("https://api.github.com");

    return new Promise((resolve, reject) => {
        const req = clientSession.request(RequestOptions);

        req.on("response", (headers) => {
            clientSession.close();

            resolve({
                status: headers[":status"] ?? -1,
                token: headers["last-modified"],
            });
        });

        req.on("error", (err) => reject(err));
        req.end();
    });
}

interface WarFileResponse {
    warFile: Buffer;
    warFileHash: string;
}

type ResponseCallback<T> = (response: IncomingMessage, resolve: (value: T) => void) => void;

const preConfigDownloadRequestOptions = (fileName: string): OutgoingHttpHeaders => ({
    [HTTP2_HEADER_METHOD]: "HEAD",
    [HTTP2_HEADER_PATH]: `/validator/validator/releases/download/latest/${fileName}`,
    [HTTP2_HEADER_USER_AGENT]: "VSCode/umoxfo.vscode-w3cvalidation",
});

async function getLocation(client: ClientHttp2Session, fileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = client.request(preConfigDownloadRequestOptions(fileName));

        req.on("response", (headers) => resolve(headers.location ?? ""));

        req.on("error", (err) => reject(err));
        req.end();
    });
}

async function getDownloadUri() {
    const client = http2.connect("https://github.com");

    const responses = files.map(async (file) => getLocation(client, file));
    const locations = await Promise.all(responses);

    client.close();
    return locations;
}

async function downloadFile<T>(uri: string, response: ResponseCallback<T>): Promise<T> {
    return new Promise((resolve, reject) =>
        https.get(uri, (res) => response(res, resolve)).on("error", (err) => reject(err))
    );
}

function getVNU(response: IncomingMessage, resolve: (value: WarFileResponse) => void): void {
    const buffs: Buffer[] = [];
    // deepcode ignore InsecureHash: Only SHA-1 and MD5 are provided as file hashes.
    const hash = crypto.createHash("sha1");

    /* eslint-disable @typescript-eslint/no-unsafe-argument */
    response.on("data", (chunk) => {
        buffs.push(chunk);
        hash.update(chunk);
    });
    /*  eslint-enable @typescript-eslint/no-unsafe-argument */

    response.on("end", () => resolve({ warFile: Buffer.concat(buffs), warFileHash: hash.digest("hex") }));
}

function getHash(response: IncomingMessage, resolve: (value: string) => void): void {
    response.setEncoding("utf8");
    let content = "";

    response.on("data", (chunk) => (content += chunk));

    response.on("end", () => resolve(content));
}

/**
 * Download latest validator
 */
async function downloadVNU(): Promise<string> {
    const [warUri, hashUri] = await getDownloadUri();

    const [{ warFile, warFileHash }, warFileChecksum] = await Promise.all([
        downloadFile(warUri ?? "", getVNU),
        downloadFile(hashUri ?? "", getHash),
    ]);

    // Validate a file
    if (warFileHash !== warFileChecksum) throw new Error("The downloaded file is invalid.");

    // Write in a file
    const warFilePath = path.join(os.tmpdir(), "vnu.war");
    await fs.writeFile(warFilePath, warFile);

    return warFilePath;
}

async function initServerArgs(jettyHome: string, jettyBase: string): Promise<string> {
    return (
        await execFilePromise("java", ["-jar", `${jettyHome}/start.jar`, "--dry-run=path"], {
            cwd: jettyBase,
        })
    ).stdout
        .substring(4)
        .trim();
}

async function updateValidator(jettyHome: string, jettyBase: string): Promise<void> {
    const [warFilePath, jettyClasspath] = await Promise.all([downloadVNU(), initServerArgs(jettyHome, jettyBase)]);
    const webappPath = path.join(jettyBase, "webapps", "vnu");

    await fs.rmdir(webappPath, { recursive: true });

    return new Promise((resolve, reject) => {
        const jettyPreconfWar = spawn(
            "java",
            [
                "-cp",
                jettyClasspath,
                "org.eclipse.jetty.quickstart.PreconfigureQuickStartWar",
                warFilePath,
                webappPath,
                path.join(jettyBase, "webapps", "vnu.xml"),
            ],
            { cwd: jettyBase }
        );

        jettyPreconfWar.on("exit", (code) => (code === 0 ? resolve() : reject()));
    });
}

async function checkValidator(jettyHome: string, jettyBase: string): Promise<void> {
    const { status, token } = await getLatestVersionInfo();
    if (status === HTTP_STATUS_NOT_MODIFIED) {
        await Promise.all([
            workspace
                .getConfiguration("vscode-w3cvalidation")
                .update("validator-token", token, ConfigurationTarget.Global),
            updateValidator(jettyHome, jettyBase),
        ]);
    }
}

export async function runValidator(jettyHome: string, jettyBase: string): Promise<ChildProcessWithoutNullStreams> {
    await checkValidator(jettyHome, jettyBase);

    return new Promise((resolve, reject) => {
        // Start the validation server
        const service = spawn("java", ["-jar", `${jettyHome}/start.jar`], { cwd: jettyBase });

        service.stderr.on("data", (data: Buffer) => {
            if (data.includes("INFO:oejs.Server:main: Started")) resolve(service);
        });

        service.on("exit", (exitCode) => {
            if (exitCode !== 0) reject(new Error("Failed to start validation server."));
        });
    });
}
