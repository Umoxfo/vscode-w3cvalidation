/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import { Command } from "commander";
import { readFile } from "fs/promises";
import { updateAppServer, updateValidator, update } from "./lib/updater";

const program = new Command("service-updater");

const GITHUB_OAUTH_TOKEN_PATTERN = /^[0-9a-f]{40}$/i;

const validateTokenPattern = (value: string) => GITHUB_OAUTH_TOKEN_PATTERN.test(value);

interface Options {
    token?: string;
    path?: string;
}

async function getGitHubOAuthToken(filePath = ""): Promise<string> {
    try {
        return (await readFile(filePath, "utf8")).trim();
    } catch (error) {
        return process.env["GITHUB_TOKEN"] ?? "";
    }
}

export default function main() {
    program
        .command("server")
        .description("Updates the Jetty server")
        .action(async () => await updateAppServer());

    program
        .command("validator")
        .description("Updates the Nu Html Checker")
        .option("-t, --token <token>", "A GitHub OAuth token", validateTokenPattern)
        .option("-p, --path <token_path>", "A file path of a GitHub OAuth token")
        .action(async (opts: Options) => await updateValidator(opts.token ?? (await getGitHubOAuthToken(opts.path))));

    program
        .command("service")
        .description("Updates the Jetty server and the Nu Html Checker")
        .option("-t, --token <token>", "A GitHub OAuth token", validateTokenPattern)
        .option("-p, --path <token_path>", "A file path of a GitHub OAuth token")
        .action(async (opts: Options) => await update(opts.token ?? (await getGitHubOAuthToken(opts.path))));

    program.parse(process.argv);

    // For default, show help
    if (!process.argv.slice(2)?.length) program.help();
}

if (require.main === module) void main();
