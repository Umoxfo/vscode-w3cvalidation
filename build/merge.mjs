/*
 * Copyright (c) Makoto Sakaguchi. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @ts-check
"use strict";

/** @private */
const clone = (/** @type Object */ obj) => JSON.parse(JSON.stringify(obj));

/** @private */
function merger(/** @type Object | Array */ baseObj = {}, /** @type Object */ obj) {
    const target = { ...baseObj };

    const objMerger = (/** @type string */ prop, /** @type Object */ val) => {
        if (Array.isArray(val)) {
            if (!target[prop]) target[prop] = [];

            for (const elem of val) {
                if (target[prop].indexOf(elem) === -1)
                    target[prop].push(clone(elem));
            }
        } else {
            target[prop] = merger(target[prop], val);
        }//if-else isArray
    }

    const objKeys = Object.keys(obj);
    for (const prop of objKeys) {
        if (typeof obj[prop] === "object") {
            objMerger(prop, obj[prop]);
        } else {
            target[prop] = obj[prop];
        }//if-else isObject
    }

    return target;
};

// Loop through each object and merge into an object
export function merge(/** @type Object */ baseOption, /** @type Array */ ...options) {
    return options.reduce((acc, currentVal) => merger(acc, currentVal), baseOption);
}
