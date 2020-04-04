/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import { workspace, ConfigurationTarget } from "vscode";

import * as https from "https";
import { promises as fs } from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
const execFilePromise = promisify(execFile);

import type { IncomingMessage } from "http";

const enum Status {
    UP_TO_DATE = 304,
    HAVE_UPDATE = 200,
}

const RequestOptions: https.RequestOptions = {
    host: "api.github.com",
    method: "HEAD",
    path: "/repos/validator/validator/releases/tags/war",
    headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "VSCode/umoxfo.vscode-w3cvalidation",
        "If-Modified-Since": workspace.getConfiguration("vscode-w3cvalidation").get("validator-token"),
    },
};

async function getLatestVersionInfo(): Promise<{ status: Status; token?: string }> {
    return new Promise((resolve, reject) => {
        const req = https.request(RequestOptions, (response) => {
            switch (response.statusCode) {
                case Status.UP_TO_DATE:
                    return resolve({ status: Status.UP_TO_DATE });
                case Status.HAVE_UPDATE:
                    return resolve({ status: Status.HAVE_UPDATE, token: response.headers["last-modified"] });
                default:
                    return reject(new Error(response.statusMessage));
            }
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

const preConfigDownloadRequestOptions = (fileName: string): https.RequestOptions => ({
    host: "github.com",
    method: "HEAD",
    path: `/validator/validator/releases/download/war/${fileName}`,
    headers: {
        "User-Agent": "VSCode/umoxfo.vscode-w3cvalidation",
    },
});

async function downloadFile<T>(fileName: string, response: ResponseCallback<T>): Promise<T> {
    const url: string = await new Promise((resolve, reject) => {
        const req = https.request(preConfigDownloadRequestOptions(fileName), (res) =>
            resolve(res.headers.location ?? "")
        );
        req.on("error", (err) => reject(err));
        req.end();
    });

    return new Promise((resolve, reject) =>
        https.get(url, (res) => response(res, resolve)).on("error", (err) => reject(err))
    );
}

function getVNU(response: IncomingMessage, resolve: (value: WarFileResponse) => void): void {
    const buffs: Buffer[] = [];
    const hash = crypto.createHash("sha1");

    response.on("data", (chunk) => {
        buffs.push(chunk);
        hash.update(chunk);
    });

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
    const [{ warFile, warFileHash }, warFileChecksum] = await Promise.all([
        downloadFile("vnu.war", getVNU),
        downloadFile("vnu.war.sha1", getHash),
    ]);

    // Validate a file
    if (warFileHash !== warFileChecksum) throw new Error("The downloaded file is invalid.");

    // Write in a file
    const warFilePath = path.join(os.tmpdir(), "vnu.war");
    await fs.writeFile(warFilePath, warFile);

    return warFilePath;
}

async function initServerArgs(jettyHome: string, jettyBase: string): Promise<string> {
    const tmp = (
        await execFilePromise("java", ["-jar", `${jettyHome}/start.jar`, "--dry-run"], { cwd: jettyBase })
    ).stdout.split(" ");
    return tmp[tmp.indexOf("-cp") + 1];
}

async function updateValidator(jettyHome: string, jettyBase: string): Promise<void> {
    try {
        const [warFilePath, jettyClasspath] = await Promise.all([downloadVNU(), initServerArgs(jettyHome, jettyBase)]);

        return new Promise((resolve, reject) => {
            const jettyPreconfWar = spawn("java", [
                "-cp",
                jettyClasspath,
                "org.eclipse.jetty.quickstart.PreconfigureQuickStartWar",
                warFilePath,
                path.join(jettyBase, "webapps/vnu"),
            ]);

            jettyPreconfWar.on("close", (code) => (code === 0 ? resolve() : reject()));
        });
    } catch (error) {
        // Ignore any errors
    }
}

export async function checkValidator(jettyHome: string, jettyBase: string): Promise<void> {
    try {
        const { status, token } = await getLatestVersionInfo();
        if (status === Status.HAVE_UPDATE) {
            await Promise.all([
                workspace
                    .getConfiguration("vscode-w3cvalidation")
                    .update("validator-token", token, ConfigurationTarget.Global),
                updateValidator(jettyHome, jettyBase),
            ]);
        }
    } catch (error) {
        // Ignore any errors (e.g. exceed the GitHub API rate limit)
    }
}
