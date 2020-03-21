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
const { merge } = require("./build/merge");
const { CleanWebpackPlugin } = require("./build/ts-build-clean-webpack-plugin");

/** @type WebpackConfig */
const ClientAdditionalConfig = {
	module: {
		rules: [{
			test: require.resolve('./client/src/Message.json'),
			type: 'javascript/auto',
			use: 'json-perf-loader'
		}]
	}
};

/** @type {(development: boolean, configName: string, filename?: string) => WebpackConfig} */
const preConfig = (development = false, configName, filename = configName) => ({
	mode: development ? 'development' : 'production',
	name: configName,
	context: path.join(__dirname, configName),
	devtool: development ? 'source-map' : false,
	target: 'node', // extensions run in a node context
	node: {
		__dirname: false // leave the __dirname-behaviour intact
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
		extensions: ['.ts', '.js'], // support ts-files and js-files
		symlinks: false
	},
	output: {
		path: path.join(__dirname, configName, 'out'),
		filename: '[name].js',
		libraryTarget: 'commonjs',
	},
	externals: {
		vscode: 'commonjs vscode', // ignored because it doesn't exist
	},
	plugins: [
		new CleanWebpackPlugin(),
		new ForkTsCheckerWebpackPlugin()
	]
});

/** @type WebpackConfigFactory */
module.exports = (env = {}) => {
	return [
		merge(preConfig(env["development"], "client", "extension"), ClientAdditionalConfig),
		preConfig(env["development"], "server")
	];
};
