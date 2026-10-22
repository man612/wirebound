#!/usr/bin/env node
'use strict'

// Verify the *contents* of an electron-builder ASAR, not merely its header.
// A build can exit successfully even when files included in the archive
// change size during packing and later entries are read at wrong offsets.
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const asar = require('@electron/asar')

const archivePath = path.resolve(
  process.argv[2] || path.join('dist', 'win-unpacked', 'resources', 'app.asar')
)

const required = [
  'package.json',
  path.join('out', 'main', 'index.js'),
  path.join('out', 'preload', 'index.js'),
  path.join('out', 'renderer', 'index.html')
]
const requiredSet = new Set(required)
const seenRequired = new Set()
const errors = []
let verified = 0
let skipped = 0

function checkFile(fileName, entry) {
  if (entry.link || entry.unpacked) {
    skipped += 1
    return
  }
  const expected = entry.integrity?.hash
  if (!expected || entry.integrity?.algorithm !== 'SHA256') {
    skipped += 1
    if (requiredSet.has(fileName)) {
      errors.push(`Missing SHA-256 metadata: ${fileName}`)
    }
    return
  }
  try {
    const content = asar.extractFile(archivePath, fileName)
    const actual = crypto.createHash('sha256').update(content).digest('hex')
    if (content.length !== entry.size || actual !== expected) {
      errors.push(`ASAR payload mismatch: ${fileName} (expected size ${entry.size}, actual ${content.length})`)
    }
    if (fileName === 'package.json') {
      const metadata = JSON.parse(content.toString('utf8'))
      if (metadata.name !== 'wirebound' || !metadata.main) {
        errors.push('ASAR package.json is not a valid Wirebound application manifest')
      }
    }
  } catch (error) {
    errors.push(`Unable to read ASAR payload ${fileName}: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
  verified += 1
}

function inspectDirectory(files, prefix = '') {
  for (const [name, entry] of Object.entries(files)) {
    const fullName = prefix ? path.join(prefix, name) : name
    if (entry.files) {
      inspectDirectory(entry.files, fullName)
    } else {
      if (requiredSet.has(fullName)) seenRequired.add(fullName)
      checkFile(fullName, entry)
    }
  }
}

try {
  if (!fs.existsSync(archivePath)) throw new Error('ASAR file does not exist')
  const { header } = asar.getRawHeader(archivePath)
  if (!header?.files) throw new Error('ASAR header has no file entries')
  inspectDirectory(header.files)

  for (const fileName of required) {
    if (!seenRequired.has(fileName)) errors.push(`Missing required application file: ${fileName}`)
  }
  if (verified === 0) errors.push('No SHA-256-protected files were inspected')

  console.log(`ASAR checked: ${path.basename(archivePath)}; verified=${verified}, skipped=${skipped}, failed=${errors.length}`)
  for (const error of errors.slice(0, 12)) console.error('  ' + error)
  if (errors.length > 12) console.error(`  ... ${errors.length - 12} more failures`)
  process.exitCode = errors.length ? 1 : 0
} catch (error) {
  console.error('ASAR validation failed:', error instanceof Error ? error.message : 'unknown error')
  process.exitCode = 1
}
