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
import fs from 'fs'

const { argv } = process

function parseList (prefix) {
  const list = []
  for (const arg of argv) {
    if (!arg.startsWith(prefix)) continue
    list.push(...arg.slice(prefix.length).split(','))
  }
  return list
}

const printCounts = argv.includes('--counts')
const printCsv = argv.includes('--csv')
const printHelp = argv.includes('-h') || argv.includes('--help')
const approved = new Set(parseList('--approve=')) // list of approved SPDX identifiers
const excludes = new Set(parseList('--exclude=')) // list of excluded package names
const excludePrefixes = parseList('--excludePrefix=') // list of exclude package prefixes
const inheritOptions = argv.include('--inherit') // inherit options from root package.json

if (printHelp) {
  // print and exit
  return console.error(```
Usage: manylicenses [options]

Options:
  --counts
  --csv
  --approve=...
  --exclude=...
  --excludePrefix=...
  --inherit
  ```)
}

// inherit options from CWD/package.json
if (inheritOptions) {
  try {
    const { manylicenses } = fs.readFileSync(`${process.cwd()}/package.json`)
    if (manylicenses) {
      approved.push(...manylicenses.approve)
      excludes.push(...manylicenses.exclude)
      excludedPrefixes.push(...manylicenses.excludedPrefix)
    }
  } catch {}
}

// read everything from stdin
const { data } = fs.readFileSync(0)
  .toString('utf8')
  .split('\n')
  .filter(Boolean)
  .map(x => JSON.parse(x))
  .filter(x => x.type === 'table')
  .pop()

function fail (message) {
  console.error(message)
  process.exit(1)
}

if (printCsv) {
  console.log(`Name, SPDX, Description, Author/Contributors, URLs`)
}

const { head, body } = data
const counts = {}

for (const rowArray of body) {
  const row = {}
  head.forEach((key, i) => (row[key] = rowArray[i]))

  const {
    Name: name,
    License: spdx,
    VendorName: rowAuthorName,
    VendorURL: rowHomepage,
    URL: rowRepository,
  } = row

  // skip excluded packages
  if (excludes.has(name)) continue

  // skip if prefix matches
  if (excludePrefixes.some((prefix) => {
    return name.startsWith(prefix)
  })) continue

  // exit error code if unapproved
  if (approved.length && !approved.has(spdx)) {
    fail(`Unapproved license ${license}`)
    break
  }

  if (printCsv) {
    let packageJson
    try {
      packageJson = JSON.parse(fs.readFileSync(`./node_modules/${name}/package.json`))
    } catch (e) {} // TODO: probably not always for workspaces

    const {
      description = '',
      author = rowAuthorName,
      contributors = [],
      homepage = rowHomepage,
      repository = rowRepository
    } = packageJson || {}

    const authorName = author?.name || author
    const contributorNames = contributors.map ? contributors.map(x => x?.name || x) : contributors
    const everyone = [authorName, ...contributorNames].join(',')
    const urls = [homepage, repository?.url || repository].filter(Boolean).join(',')

    console.log(`${name}, "${spdx}", "${description}", "${everyone}", "${urls}"`)
  }

  counts[spdx] = (counts[spdx] || 0) + 1
}

if (printCounts) {
  console.log(counts)
}
