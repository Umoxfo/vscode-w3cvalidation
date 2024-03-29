/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
"use strict";

import { request as httpRequest } from "http";

import type { RequestOptions as HttpRequestOptions } from "http";

/**
 * Message object of the validation result
 */
export interface Message {
    /*
     * "info" is an informational message or warning that does not affect the validity of the document being checked.
     * "error" signifies a problem that causes the validation/checking to fail.
     * "non-document-error" indicates that the examination ended in an indeterminate state
     * because the document being validated could not be examined to the end.
     */
    readonly type: "info" | "error" | "non-document-error";

    /*
     * See https://github.com/validator/validator/wiki/Output-»-JSON#the-url-string
     */
    readonly url?: string;

    /*
     * The "firstLine", "firstColumn", "lastLine" and "lastColumn"
     * indicate a range of source code associated with the message.
     * The line and column numbers are one-based:
     *   The first line is line 1
     *   The first column is column 1
     */
    readonly lastLine?: number;
    readonly firstLine?: number; // If the attribute is missing, it is the same value as "lastLine".
    readonly lastColumn?: number;
    readonly firstColumn?: number;

    /*
     * type: "info" is "warning" (something questionable issue);
     * in the absence of the "subtype" key, general information
     * type: "error" is "fatal" (an XML well-formedness error) more information see
     * https://github.com/validator/validator/wiki/Output-»-JSON#the-subtype-string;
     * in the absence of the "subtype" key, a spec violation in general
     * type: "non-document-error" are:
     *   "io" (an input/output error)
     *   "schema" (initializing a schema-based validator failed)
     *   "internal" (the validator/checker found an error bug in itself, ran out of memory, etc.)
     *   Undefined is a problem external to the document in general
     */
    readonly subType?: "warning" | "fatal" | "io" | "schema" | "internal";

    /*
     * See https://github.com/validator/validator/wiki/Output-»-JSON#the-message-string
     */
    readonly message?: string;

    /*
     * See https://github.com/validator/validator/wiki/Output-»-JSON#the-extract-string
     */
    readonly extract?: string;

    readonly hiliteStart?: number;
    readonly hiliteLength?: number;
}

/**
 * Validation result format
 */
interface ValidationResult {
    readonly url?: string;
    readonly messages: Message[] | [];

    /*
     * The "source" object
     */
    readonly source?: {
        /*
         * See https://github.com/validator/validator/wiki/Output-»-JSON#the-code-string
         */
        readonly code: string;

        /*
         * See https://github.com/validator/validator/wiki/Output-»-JSON#the-type-string-1
         */
        readonly type?: string;

        /*
         * See https://github.com/validator/validator/wiki/Output-»-JSON#the-encoding-string
         */
        readonly encoding?: string;
    };

    /*
     * See https://github.com/validator/validator/wiki/Output-»-JSON#the-language-string
     */
    readonly language?: string;
}

const RequestOptions: HttpRequestOptions = {
    host: "localhost",
    port: 8888,
    method: "POST",
    path: "/?out=json",
    headers: {
        "Content-Type": "text/html; charset=utf-8",
        "User-Agent": "Validator.nu/LV",
    },
};

/*
enum MediaTypes {
    html = "text/html",
    css = "text/css",
    svg = "image/svg+xml",
}
*/

/*
 * Sends document to the local validation server
 */
export async function sendDocument(document: string): Promise<Message[]> {
    return new Promise((resolve, reject) => {
        // Set the request headers
        // RequestOptions.headers["Content-Type"] = `${MediaTypes[document.languageId as keyof typeof MediaTypes]}; charset=utf-8`;

        const request = httpRequest(RequestOptions, (response) => {
            // handle http errors
            response.statusCode = response.statusCode ?? 0;
            if (response.statusCode < 200 || response.statusCode > 299) reject();

            // temporary data holder
            response.setEncoding("utf8");
            let body = "";

            // on every content chunk, push it to the string
            response.on("data", (chunk): string => (body += chunk));

            // we are done, resolve promise with those joined chunks
            response.on("end", () => resolve((JSON.parse(body) as ValidationResult).messages));
        });

        // handle connection errors of the request
        request.on("error", (err) => reject(err));

        // write data to request body
        request.end(document);
    });
}
