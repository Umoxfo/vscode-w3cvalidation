/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @ts-check

"use strict";

import { build } from "esbuild";

const DEVELOPMENT = false;

/**
 * @param {string} configName
 */
function runBuild(configName, fileName = configName) {
    return build({
        entryPoints: [`${configName}/src/${fileName}.ts`],
        outfile: `${configName}/out/${fileName}.js`,
        bundle: true,
        minify: !DEVELOPMENT,
        platform: "node",
        external: ["vscode"],
    });
}

(async () => {
    await Promise.allSettled([runBuild("client", "extension"), runBuild("server")]);
})();
