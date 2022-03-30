/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import path from "path";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
const execFilePromise = promisify(execFile);
import { promises as fs } from "fs";

import { updateVNU } from "./vnu";
import { updateJetty } from "./Jetty";

const SERVER_SERVICE = path.join(process.cwd(), "service");
const JETTY_BASE = path.join(SERVER_SERVICE, "vnu");
const WEBAPP_VNU = path.join(JETTY_BASE, "webapps", "vnu");

/**
 * Pre-generate the quickstart-web.xml file
 * @param {string} warFilePath The path to the war file
 * @returns {Promise<void>}
 */
async function configQuickstart(warFilePath: string): Promise<void> {
    // Get the Jetty Quickstart classpath
    const { stdout } = await execFilePromise(
        "java",
        ["-jar", `${path.join(SERVER_SERVICE, "jetty-home", "start.jar")}`, "--dry-run=path"],
        { cwd: JETTY_BASE }
    );
    const jettyClasspath = stdout.substring(12).trim();

    await fs.rmdir(WEBAPP_VNU, { recursive: true });

    return new Promise((resolve, reject) => {
        const jettyPreconfWar = spawn(
            "java",
            [
                "--class-path",
                jettyClasspath,
                "org.eclipse.jetty.quickstart.PreconfigureQuickStartWar",
                warFilePath,
                WEBAPP_VNU,
                path.join(JETTY_BASE, "webapps", "vnu.xml"),
            ],
            { cwd: JETTY_BASE }
        );

        jettyPreconfWar.stdout.pipe(process.stdout);
        jettyPreconfWar.stderr.pipe(process.stderr);

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
    return configQuickstart(warFilePath);
}

/**
 * Updates the Nu Html Checker
 * @param token A GitHub OAuth token
 * @returns Returns the resolved `Promise` with no arguments upon the success.
 */
export async function updateValidator(token = ""): Promise<void> {
    const [warFilePath] = await updateVNU(token);
    return configQuickstart(warFilePath);
}

export { updateJetty as updateAppServer };
