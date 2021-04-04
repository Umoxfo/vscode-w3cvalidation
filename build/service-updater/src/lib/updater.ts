/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import * as path from "path";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
const execFilePromise = promisify(execFile);
import { promises as fs } from "fs";

import { updateVNU } from "./vnu";
import { updateJetty } from "./Jetty";

const JETTY_HOME = path.join(process.cwd(), "server", "service", "jetty-home");
const JETTY_BASE = path.join(process.cwd(), "server", "service", "vnu");

/**
 * Pre-generate the quickstart-web.xml file
 * @param {string} warFilePath The path to the war file
 * @returns {Promise<void>}
 */
async function genQuickstartWeb(warFilePath: string): Promise<void> {
    // Get the Jetty Quickstart classpath
    const tmp = (
        await execFilePromise("java", ["-jar", `${JETTY_HOME}/start.jar`, "--dry-run"], { cwd: JETTY_BASE })
    ).stdout.split(" ");
    const jettyClasspath = tmp[tmp.indexOf("-cp") + 1];
    const webappPath = path.join(JETTY_BASE, "webapps", "vnu");

    await fs.rmdir(webappPath, { recursive: true });

    return new Promise((resolve, reject) => {
        const jettyPreconfWar = spawn("java", [
            "--class-path",
            jettyClasspath,
            "org.eclipse.jetty.quickstart.PreconfigureQuickStartWar",
            warFilePath,
            webappPath,
        ]);

        jettyPreconfWar.on("exit", (code) => (code === 0 ? resolve() : reject()));
    });
}

/**
 * Updates the Jetty server and the Nu Html Checker
 * @param token A GitHub OAuth token
 * @returns Returns the resolved `Promise` with no arguments upon the success.
 */
export async function update(token = ""): Promise<void> {
    const [, [warFilePath]] = await Promise.all([updateJetty(), updateVNU(token)]);
    return genQuickstartWeb(warFilePath);
}

/**
 * Updates the Nu Html Checker
 * @param token A GitHub OAuth token
 * @returns Returns the resolved `Promise` with no arguments upon the success.
 */
export async function updateValidator(token = ""): Promise<void> {
    const [warFilePath] = await updateVNU(token);
    return genQuickstartWeb(warFilePath);
}

export { updateJetty as updateAppServer };
