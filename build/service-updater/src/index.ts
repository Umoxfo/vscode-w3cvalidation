/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import commander from "commander";
import { promises as fs } from "fs";
import { updateAppServer, updateValidator, update } from "./lib/updater";

const program = new commander.Command("service-updater");

async function getGitHubOAuthToken(filePath = ""): Promise<string> {
    try {
        return (await fs.readFile(filePath, "utf8")).trim();
    } catch (error) {
        return "";
    }
}

export default async function main(): Promise<void> {
    program
        .command("server")
        .description("Updates the Jetty server")
        .action(async () => await updateAppServer());

    program
        .command("validator")
        .description("Updates the Nu Html Checker")
        .option("-t, --token <token>", "A GitHub OAuth token", /^[0-9a-f]{40}$/)
        .option("-p, --path <token_path>", "A file path of a GitHub OAuth token")
        .action(async (opts) => await updateValidator(await (opts.token ?? getGitHubOAuthToken(opts.path))));

    program
        .command("service")
        .description("Updates the Jetty server and the Nu Html Checker")
        .option("-t, --token <token>", "A GitHub OAuth token", /^[0-9a-f]{40}$/)
        .option("-p, --path <token_path>", "A file path of a GitHub OAuth token")
        .action(async (opts) => await update(await (opts.token ?? getGitHubOAuthToken(opts.path))));

    await program.parseAsync(process.argv);

    // For default, show help
    if (!process.argv.slice(2)?.length) program.help();
}

if (require.main === module) void main();
