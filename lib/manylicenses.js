#!/usr/bin/env node
//  MIT License
//
//  Copyright (c) 2021 Thinkmill Labs Pty Ltd
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in all
//  copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//  SOFTWARE.
import fs from 'fs';
const { argv } = process;
function parseList(prefix) {
    const list = [];
    for (const arg of argv) {
        if (!arg.startsWith(prefix))
            continue;
        list.push(...arg.slice(prefix.length).split(','));
    }
    return list;
}
const printCounts = argv.includes('--counts');
const printCsv = argv.includes('--csv');
const printHelp = argv.includes('-h') || argv.includes('--help');
const approved = parseList('--approve='); // list of approved SPDX identifiers
const excludes = parseList('--exclude='); // list of excluded package names
const excludePrefixes = parseList('--exclude-prefix='); // list of exclude package prefixes
const verify = !argv.includes('--no-verify'); // ignore unapproved licenses
if (printHelp) {
    // print and exit
    console.error(`
Usage: manylicenses [options]

Options:
  --counts
  --csv
  --approve=NAME[,...]
  --exclude=NAME[,...]
  --exclude-prefix=NAME[,...]
  --no-verify
  `);
    process.exit(0);
}
// merge options from CWD/package.json
let manylicenses;
try {
    ({ manylicenses } = JSON.parse(fs.readFileSync(`${process.cwd()}/package.json`).toString()));
}
catch { }
function coerceArray(value) {
    return Array.isArray(value) ? value : [value];
}
if (manylicenses) {
    approved.push(...coerceArray(manylicenses?.approve || []));
    excludes.push(...coerceArray(manylicenses?.exclude || []));
    excludePrefixes.push(...coerceArray(manylicenses?.excludePrefix || []));
}
// read everything from stdin
const { data } = fs.readFileSync(0)
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map(x => JSON.parse(x))
    .filter(x => x.type === 'table')
    .pop();
function fail(message) {
    console.error(message);
    process.exit(1);
}
if (printCsv) {
    console.log(`Name, Version, SPDX, Description, Authors/Contributors, URLs`);
}
const { head, body } = data;
const counts = {};
const unapproved = [];
for (const rowArray of body) {
    const row = {};
    head.forEach((key, i) => {
        const value = rowArray[i];
        // drop unknowns
        if (value.toLowerCase() === 'unknown')
            return;
        row[key] = rowArray[i];
    });
    const { Name: name = '', Version: version = '', License: spdx = '', VendorName: rowAuthorName = '', VendorURL: rowHomepage = '', URL: rowRepository = '', } = row;
    // skip excluded packages
    if (excludes.includes(name))
        continue;
    // skip if prefix matches
    if (excludePrefixes.some((prefix) => {
        return name.startsWith(prefix);
    }))
        continue;
    // exit error code if unapproved
    if (verify && !approved.includes(spdx)) {
        unapproved.push({ name, spdx });
        console.error(`"${name}@${version}" has unapproved license: "${spdx}"`);
    }
    if (printCsv) {
        let packageJson = {};
        try {
            packageJson = JSON.parse(fs.readFileSync(`./node_modules/${name}/package.json`).toString());
        }
        catch (e) { } // TODO: workspaces
        const { description = '', author = rowAuthorName, contributors = [], homepage = rowHomepage, repository = rowRepository } = packageJson || {};
        const authorName = (typeof author === 'string') ? author : author?.name;
        const contributorNames = Array.isArray(contributors) ? contributors.map((x) => typeof x === 'string' ? x : x?.name || x) : contributors;
        const everyone = [authorName, ...contributorNames].join(',');
        const urls = [homepage, typeof repository === 'string' ? repository : repository?.url].filter(Boolean).join(',');
        console.log(`"${name}", "${version}", "${spdx}", "${description}", "${everyone}", "${urls}"`);
    }
    counts[spdx] = (counts[spdx] || 0) + 1;
}
if (unapproved.length) {
    fail(`Unapproved licenses: ${[...new Set(unapproved.map(({ spdx }) => `"${spdx}"`))].join(', ')}`);
}
if (printCounts) {
    console.log(counts);
}
