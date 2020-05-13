/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import { getOptions } from "loader-utils";
// import * as schema from "./options.json";

import type { loader } from "webpack";

// Default limit: 10 KiB
const DEFAULT_OPTIONS = { limit: 10_240 };

export default function jsonPerfLoader(this: loader.LoaderContext, source: unknown): void {
    const callback = this.async() as loader.loaderCallback;

    // For Webpack 5
    // this.getOptions(schema)
    const options = { ...DEFAULT_OPTIONS, ...getOptions(this) };

    let value = "";
    try {
        const tmp = typeof source === "string" ? JSON.parse(source) : source;
        value = JSON.stringify(tmp);
    } catch (error) {
        this.emitError(error);
    }

    // https://v8.dev/blog/cost-of-javascript-2019#json
    value =
        value.length < options.limit
            ? value.replace(/(\u2028)|(\u2029)/g, (substr, p1, p2) => (p1 ? "\\u2028" : p2 ? "\\u2029" : substr))
            : `JSON.parse(${value})`;

    callback(null, `module.exports = ${value}`);
}
