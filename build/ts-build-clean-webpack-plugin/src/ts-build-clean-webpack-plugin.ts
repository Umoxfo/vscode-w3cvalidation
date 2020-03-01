/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

"use strict";

import { promises as fs } from "fs";
import { promisify } from "util";
import { execFile } from "child_process"
const execFilePromise = promisify(execFile);
import * as Message from "./Message.json";

// eslint-disable-next-line prettier/prettier
import type { Compiler, Stats, compilation as compilationType } from "webpack";
type Compilation = compilationType.Compilation;

const PLUGIN_NAME = "ts-build-clean-webpack-plugin";

export interface Options {
    /**
     * Write Logs to Console
     * (Always enabled when dry is true)
     *
     * default: false
     */
    verbose?: boolean;

    /**
     * Automatically remove all unused webpack assets on rebuild
     *
     * default: true
     */
    cleanStaleWebpackAssets?: boolean;

    /**
     * Removes files after every build (including watch mode) that match this pattern.
     * Used for files that are not created directly by Webpack.
     *
     * Use !negative patterns to exclude files
     *
     * default: []
     */
    cleanAfterEveryBuildPatterns?: string[];
}

// Copied from https://github.com/sindresorhus/is-plain-obj/blob/97480673cf12145b32ec2ee924980d66572e8a86/index.js
function isPlainObject(value: unknown): boolean {
    if (Object.prototype.toString.call(value) !== "[object Object]") return false;

    const prototype = Object.getPrototypeOf(value);
    return prototype === null || prototype === Object.getPrototypeOf({});
}

export class CleanWebpackPlugin {
    private readonly verbose: boolean;
    private readonly cleanStaleWebpackAssets: boolean;
    private readonly cleanAfterEveryBuildPatterns: string[];
    private currentAssets: string[];
    private initialClean: boolean;
    private configName: string;
    private outputPath: string;

    constructor(options: Options = {}) {
        if (!isPlainObject(options)) throw new TypeError(Message.OptionsTypeError);

        this.verbose = options?.verbose ?? false;
        this.cleanStaleWebpackAssets = options?.cleanStaleWebpackAssets ?? true;

        this.cleanAfterEveryBuildPatterns = Array.isArray(options?.cleanAfterEveryBuildPatterns)
            ? options.cleanAfterEveryBuildPatterns : [];

        /*
         * Store webpack build assets
         */
        this.currentAssets = [];

        this.configName = "";
        this.outputPath = "";

        /*
         * Only used with cleanOnceBeforeBuildPatterns
         */
        this.initialClean = false;

        // this.apply = this.apply.bind(this);
        // this.handleInitial = this.handleInitial.bind(this);
        // this.handleDone = this.handleDone.bind(this);
        // this.removeFiles = this.removeFiles.bind(this);
    }

    apply(compiler: Compiler): void {
        if (!compiler.options.output || !compiler.options.output.path) {
            process.stderr.write(Message.OutputPathWarning);
            return;
        }

        this.configName = compiler.options?.name ?? "";
        this.outputPath = compiler.options.output.path;

        compiler.hooks.emit.tapPromise(PLUGIN_NAME, async (compilation) => this.handleInitial(compilation));

        compiler.hooks.done.tapPromise(PLUGIN_NAME, async (stats) => this.handleDone(stats));
    }

    /**
     * Initially remove files from output directory prior to build.
     *
     * Only happens once.
     *
     * Warning: It is recommended to initially clean your build directory outside of webpack to minimize unexpected behavior.
     */
    async handleInitial(compilation: Compilation): Promise<void> {
        if (this.initialClean) return;

        /**
         * Do not remove files if there are compilation errors
         *
         * Handle logging inside this.handleDone
         */
        if (compilation.getStats().hasErrors()) return;

        this.initialClean = true;

        return this.removeFiles();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async handleDone(stats: Stats): Promise<void> {
        /*
         * Do nothing if there is a webpack error
         */
        if (stats.hasErrors()) {
            if (this.verbose) process.stderr.write(Message["HandleDone.WebpackError"]);
            return;
        }

        /*
         * Fetch Webpack's output asset files
         */
        const assets = stats.toJson({ assets: true, assetsSort: "name" }, true)?.assets ?? [];
        const assetList = assets.map((asset: { name: string }) => asset.name);

        /*
         * Get all files that were in the previous build but not the current
         */
        const staleFiles = this.currentAssets.filter((previousAsset) => !assetList.includes(previousAsset));

        /*
         * Save assets for next compilation
         */
        this.currentAssets = assetList;

        const removePatterns: string[] = [];

        /*
         * Remove unused webpack assets
         */
        if (this.cleanStaleWebpackAssets && staleFiles.length !== 0) removePatterns.push(...staleFiles);

        /*
         * Remove cleanAfterEveryBuildPatterns
         */
        if (this.cleanAfterEveryBuildPatterns.length !== 0) {
            removePatterns.push(...this.cleanAfterEveryBuildPatterns);
        }

        // if (removePatterns.length !== 0) return this.removeFiles();
    }// handleDonePromise

    async removeFiles(): Promise<void> {
        await Promise.all([
            fs.unlink(`./${this.configName}/tsconfig.tsbuildinfo`),
            fs.rmdir(this.outputPath, { recursive: true }),
        ]).catch(async (err) =>
            (err.code !== "ENOENT")
                ? execFilePromise("npx", ["tsc", "-b", "--clean", this.configName], { shell: true })
                : Promise.resolve()
        );

        /**
         * Log if verbose is enabled
         */
        if (this.verbose) {
            // deleted.forEach((file) => {
            //     const filename = path.relative(process.cwd(), file);

            //     /**
            //      * Use console.warn over .log
            //      * https://github.com/webpack/webpack/issues/1904
            //      * https://github.com/johnagan/clean-webpack-plugin/issues/11
            //      */
            //     // eslint-disable-next-line no-console
            //     console.warn(`clean-webpack-plugin: removed ${filename}`,);
            // });
        }
    }
}
