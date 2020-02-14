/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import { workspace, ConfigurationTarget } from "vscode";

import * as https from "https";
import { IncomingMessage } from "http";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
import { spawn } from "child_process";

import { classpath, PreconfigureQuickStart, deployDir } from "./Preconfig.json";

const enum Status {
    UP_TO_DATE = 304,
    HAVE_UPDATE = 200,
}

const RequestOptions: https.RequestOptions = {
    host: "api.github.com",
    method: "HEAD",
    path: "/repos/validator/validator/releases/tags/war",
    headers: {
        "User-Agent": "VSCode/umoxfo.vscode-w3cvalidation",
        "If-Modified-Since": workspace.getConfiguration("vscode-w3cvalidation").get("validator-token"),
    },
};

async function getLatestVersionInfo(): Promise<Status> {
    return new Promise((resolve, reject): void => {
        const req = https.request(RequestOptions, (response): void => {
            switch (response.statusCode) {
                case Status.UP_TO_DATE:
                    return resolve(Status.UP_TO_DATE);
                case Status.HAVE_UPDATE:
                    workspace
                        .getConfiguration("vscode-w3cvalidation")
                        .update("validator-token", response.headers["last-modified"], ConfigurationTarget.Global);

                    return resolve(Status.HAVE_UPDATE);
                default:
                    return reject(new Error(response.statusMessage));
            }
        });

        req.on("error", (err): void => reject(err));
        req.end();
    });
}

type ResponseCallback = (response: IncomingMessage, fileName?: string) => Promise<string>;

const DownloadRequest: https.RequestOptions = {
    host: "github.com",
    method: "HEAD",
    path: "",
    headers: {
        "User-Agent": "VSCode/umoxfo.vscode-w3cvalidation",
    },
};

async function downloadFile(fileName: string, response: ResponseCallback): Promise<string> {
    const url: string = await new Promise((resolve, reject): void => {
        DownloadRequest.path = `/validator/validator/releases/download/war/${fileName}`;

        const req = https.request(DownloadRequest, (res): void => resolve(res.headers.location ?? ""));
        req.on("error", (err): void => reject(err));
        req.end();
    });

    return new Promise((resolve, reject) =>
        https.get(url, (res) => resolve(response(res, fileName))).on("error", (err): void => reject(err))
    );
}

async function checksumFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha1").setEncoding("hex");

        fs.createReadStream(filePath)
            .on("error", (err) => reject(err))
            .pipe(hash)
            .on("finish", () => resolve(hash.read()));
    });
}

const getVNU = async (response: IncomingMessage, fileName?: string): Promise<string> =>
    new Promise((resolve) => {
        const warFile = fs.createWriteStream(path.join(os.tmpdir(), fileName));

        response.pipe(warFile);

        response.on("end", () => {
            warFile.close();
            resolve(warFile.path as string);
        });
    });

const getHash = async (response: IncomingMessage): Promise<string> =>
    new Promise((resolve) => {
        response.setEncoding("utf-8");
        let body = "";

        response.on("data", (chunk): string => (body += chunk));

        response.on("end", () => resolve(body));
    });

/**
 * Download latest validator
 */
async function downloadVNU(): Promise<string> {
    const [warFilePath, warFileHash] = await Promise.all([
        downloadFile("vnu.war", getVNU),
        downloadFile("vnu.war.sha1", getHash),
    ]);

    const warFileChecksum = await checksumFile(warFilePath);

    return warFileChecksum === warFileHash ? Promise.resolve(warFilePath) : Promise.reject(new Error("Hash Error"));
}

async function initServerArgs(jettyHome: string): Promise<string> {
    return Promise.all(
        classpath.jettyClasspath.map(async (item) => Promise.resolve(path.join(jettyHome, item)))
    ).then((cp) => cp.join(path.delimiter));
}

async function updateValidator(jettyHome: string, jettyBase: string): Promise<void> {
    let warFilePath: string;
    let jettyClasspath: string;
    try {
        [warFilePath, jettyClasspath] = await Promise.all([downloadVNU(), initServerArgs(jettyHome)]);

        await new Promise((resolve, reject) => {
            const jettyPreconfWar = spawn("java", [
                "-cp",
                jettyClasspath,
                PreconfigureQuickStart,
                warFilePath,
                path.join(jettyBase, deployDir),
            ]);

            jettyPreconfWar.on("close", (code) => (code === 0 ? resolve() : reject()));
        });
    } catch (error) {
        // Ignore any errors
    }
}

export async function checkValidator(jettyHome: string, jettyBase: string): Promise<void> {
    try {
        const status = await getLatestVersionInfo();
        if (status === Status.HAVE_UPDATE) {
            await updateValidator(jettyHome, jettyBase);
        }
    } catch (error) {
        // Ignore any errors (e.g. exceed the GitHub API rate limit)
    }
}
