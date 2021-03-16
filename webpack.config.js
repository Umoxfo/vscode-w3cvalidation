/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig */
/** @typedef {import('webpack').MultiConfigurationFactory} WebpackConfigFactory */

"use strict";

const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

const path = require("path");
const { CleanWebpackPlugin } = require("./build/ts-build-clean-webpack-plugin");

/** @type {(configName: string, filename?: string) => WebpackConfig} */
const preConfig = (configName, filename = configName) => ({
	mode: 'production',
	devtool: "source-map",
	name: configName,
	context: path.join(__dirname, configName),
	// Extensions run in a node context
	target: 'async-node',
	node: {
		// Leave the __dirname-behaviour intact
		__dirname: false
	},
	entry: {
		[filename]: `./src/${filename}.ts`
	},
	module: {
		rules: [{
			test: /\.ts$/,
			exclude: /node_modules/,
			use: [{
				loader: 'ts-loader',
				options: {
					transpileOnly: true
				}
			}]
		}]
	},
	resolve: {
		// Support ts- and js-files
		extensions: ['.ts', '.js'],
		symlinks: false
	},
	output: {
		path: path.join(__dirname, configName, 'out'),
		filename: '[name].js',
		libraryTarget: 'commonjs2',
	},
	externals: {
		// The vscode-module is created on-the-fly and must be excluded.
		vscode: 'commonjs vscode',
	},
	externalsPresets: {
		node: true,
	},
	optimization: {
		splitChunks: {
			chunks: 'all',
		},
		runtimeChunk: 'single',
	},
	plugins: [
		new CleanWebpackPlugin(),
		new ForkTsCheckerWebpackPlugin()
	]
});

/** @type WebpackConfigFactory */
module.exports = (env, argv) => {
	if (argv.mode === "development") {
		argv.devtool = "source-map";
		// config.devtool = "eval-source-map";
	}

	return [
		preConfig("client", "extension"),
		preConfig("server"),
	];
};
