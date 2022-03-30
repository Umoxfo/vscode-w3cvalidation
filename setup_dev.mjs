/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @ts-check

"use strict";

import { fileURLToPath } from 'url';
import { spawn, execFile } from "child_process";
import { promisify } from "util";
const execFilePromise = promisify(execFile);

/**
 * Working directory where the NPM command is executed
 * @readonly
 */
const projects = ["./test", "./client", "./server"];

/**
 * NPM command runner
 *
 * @param {string} command NPM command to be executed
 * @param {string} cwd Working directory where NPM command will be executed
 * @returns {Promise<void>} Resolved the `Promise` with no arguments upon success.
 */
async function runWithCWD(command, cwd) {
    return new Promise((resolve, reject) => {
        const runner = spawn("npm", [command], { cwd, shell: true, stdio: "inherit" });

        runner.on("close", (code) => ((code === 0) ? resolve() : reject()));
        runner.on("error", (err) => reject(err));
    });
}

async function postinstall() {
    for (const project of projects) {
        process.stdout.write(`${project}\n`);

        await runWithCWD("install", project);

        process.stdout.write(`\n`);
    }
}

/** @type {(cwd: string) => Promise<{ stdout: string }>} */
const outdate = async (cwd) => execFilePromise("npm", ["outdate"], { cwd, shell: true })
    .catch((err) => (!err.stderr) ? { stdout: err.stdout } : Promise.reject(err));

/** @type {(message: string) => Promise<string>} */
function prompt(message) {
    process.stdout.write(message);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    return new Promise((r) => process.stdin.once("data", r)).finally(() => process.stdin.pause());
}

async function update() {
    console.clear();
    for (const project of projects) {
        const { stdout } = await outdate(project);
        if (!stdout) continue;

        process.stdout.write(`${stdout}\n`);
        const ans = (await prompt("Do you want to update these package(s)? (yes): ")).trim().toLowerCase();

        if (ans !== "" && (ans !== "yes" && ans !== "y")) continue;
        await runWithCWD("update", project);

        process.stdout.write("\n");
    }
}

async function main(/** @type string */ command) {
    switch (command) {
        case "install": return await postinstall();
        case "update": return await update();
        default: return;
    }
}

// @ts-ignore
if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv[2]);
