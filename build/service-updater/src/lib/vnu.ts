/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import { request as httpsRequest, get as httpsGet } from "https";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { getArchive, getPlainText } from "./downloader";

import type { RequestOptions } from "https";
import type { IncomingMessage } from "http";

interface VnuQueryResponse {
    data: {
        repository: {
            release: {
                releaseAssets: {
                    nodes?: {
                        name: string;
                        url: string;
                    }[];
                };
                updatedAt: string;
            };
        };
    };
}

interface ReleaseAsset {
    name: string;
    url: string;
}

type VnuReleaseQueryResponse = [ReleaseAsset[], string];
type ResponseCallback<T> = (response: IncomingMessage, resolve: (value: T) => void) => void;

const VNU_QUERY = {
    query: `query {
            repository(name: "validator", owner: "validator") {
                release(tagName: "war") {
                    releaseAssets(last: 6) {
                        nodes {
                            name
                            url
                        }
                    }
                    updatedAt
                }
            }
        }`.replace(/\s{2,}/gm, " "),
};

const assetNames: readonly string[] = ["vnu.war", "vnu.war.sha1"];

function getAsset(queryResponse: VnuQueryResponse): VnuReleaseQueryResponse {
    const {
        releaseAssets: { nodes },
        updatedAt,
    } = queryResponse.data.repository.release;

    const releaseAssets: ReleaseAsset[] = [];
    for (const { name, url } of nodes ?? []) {
        const index = assetNames.indexOf(name);
        if (index === -1) continue;

        releaseAssets[index] = { name, url };
    }

    return [releaseAssets, new Date(updatedAt).toUTCString()];
}

const preConfigRequestOptions = (token: string): RequestOptions => ({
    host: "api.github.com",
    method: "POST",
    path: "/graphql",
    headers: {
        Authorization: `bearer ${token}`,
        "User-Agent": "VSCode/umoxfo.vscode-w3cvalidation",
    },
});

async function getLatestVersionInfo(token: string): Promise<VnuReleaseQueryResponse> {
    return new Promise((resolve, reject) => {
        const req = httpsRequest(preConfigRequestOptions(token), (response) => {
            response.setEncoding("utf8");
            let body = "";

            response.on("data", (chunk) => (body += chunk));

            response.on("end", () => resolve(getAsset(JSON.parse(body))));
        });

        req.on("error", (err) => reject(err));
        req.end(JSON.stringify(VNU_QUERY));
    });
}

const preConfigDownloadRequestOptions = (fileName: string): RequestOptions => ({
    host: "github.com",
    method: "HEAD",
    path: `/validator/validator/releases/download/war/${fileName}`,
    headers: {
        "User-Agent": "VSCode/umoxfo.vscode-w3cvalidation",
    },
});

function getDownloadUrls(): Promise<ReleaseAsset>[] {
    return assetNames.map(
        async (fileName) =>
            new Promise<ReleaseAsset>((resolve, reject) => {
                const reqOpts = preConfigDownloadRequestOptions(fileName);

                const req = httpsRequest(reqOpts, (res) =>
                    resolve({ name: fileName, url: res.headers?.location ?? "" })
                );
                req.on("error", (err) => reject(err));
                req.end();
            })
    );
}

const RESTRequestOptions: RequestOptions = {
    host: "api.github.com",
    method: "HEAD",
    path: "/repos/validator/validator/releases/tags/war",
    headers: {
        "User-Agent": "VSCode/umoxfo.vscode-w3cvalidation",
    },
};

async function getLastUpdateDate(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const req = httpsRequest(RESTRequestOptions, (res) => resolve(res.headers["last-modified"] ?? ""));

        req.on("error", (err) => reject(err));
        req.end();
    });
}

const getLatestVersionInfoREST = async (): Promise<VnuReleaseQueryResponse> =>
    Promise.all([Promise.all(getDownloadUrls()), getLastUpdateDate()]);

const downloadFile = async <T>(url: string, response: ResponseCallback<T>): Promise<T> =>
    new Promise((resolve, reject) => httpsGet(url, (res) => response(res, resolve)).on("error", (err) => reject(err)));

/**
 * Download latest validator
 */
async function downloadVNU([file, checksum]: ReleaseAsset[]): Promise<string> {
    const [{ archive, archiveHash }, warFileChecksum] = await Promise.all([
        downloadFile(file.url, getArchive),
        downloadFile(checksum.url, getPlainText),
    ]);

    // Validate a file
    if (archiveHash !== warFileChecksum) throw new Error("The downloaded file is invalid.");

    // Write in a file
    const warFilePath = path.join(os.tmpdir(), "vnu.war");
    await fs.writeFile(warFilePath, archive);

    return warFilePath;
}

async function updateValidatorToken(token: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pkg = JSON.parse(await fs.readFile("./package.json", "utf8"));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    pkg.contributes.configuration.properties["vscode-w3cvalidation.validator-token"].default = token;

    return fs.writeFile("./package.json", JSON.stringify(pkg, null, 4));
}

export async function updateVNU(token = ""): Promise<[string, void]> {
    const [releaseAssets, updatedAt] = await (token ? getLatestVersionInfo(token) : getLatestVersionInfoREST());
    return Promise.all([downloadVNU(releaseAssets ?? []), updateValidatorToken(updatedAt)]);
}
