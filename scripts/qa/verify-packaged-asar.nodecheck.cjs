'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')
const asar = require('@electron/asar')

function createFixtures(root) {
  fs.mkdirSync(path.join(root, 'out', 'main'), { recursive: true })
  fs.mkdirSync(path.join(root, 'out', 'preload'), { recursive: true })
  fs.mkdirSync(path.join(root, 'out', 'renderer'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'wirebound', version: '1.2.0', main: './out/main/index.js'
  }))
  fs.writeFileSync(path.join(root, 'out', 'main', 'index.js'), "console.log('main')\n")
  fs.writeFileSync(path.join(root, 'out', 'preload', 'index.js'), "console.log('preload')\n")
  fs.writeFileSync(path.join(root, 'out', 'renderer', 'index.html'), '<html><body>Wirebound</body></html>\n')
}

test('ASAR checker accepts a valid payload and rejects tampered payload', async (t) => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'wirebound-asar-check-'))
  t.after(() => fs.rmSync(workdir, { recursive: true, force: true }))
  const input = path.join(workdir, 'input')
  const archive = path.join(workdir, 'valid.asar')
  fs.mkdirSync(input)
  createFixtures(input)
  await asar.createPackage(input, archive)
  const verify = path.join(__dirname, 'verify-packaged-asar.cjs')
  const ok = spawnSync(process.execPath, [verify, archive], { encoding: 'utf8' })
  assert.equal(ok.status, 0, ok.stdout + ok.stderr)

  // Corrupt the payload without modifying its header and declared hash.
  // A header-only check would incorrectly accept it.
  const { header, headerSize } = asar.getRawHeader(archive)
  const entry = header.files['package.json']
  assert.equal(entry.integrity.algorithm, 'SHA256')
  // ASAR starts with two four-byte pickle fields before headerSize bytes.
  const position = 8 + headerSize + Number(entry.offset)
  const fd = fs.openSync(archive, 'r+')
  try {
    const replacement = Buffer.from('!')
    fs.writeSync(fd, replacement, 0, replacement.length, position)
  } finally {
    fs.closeSync(fd)
  }
  asar.uncacheAll()
  const bad = spawnSync(process.execPath, [verify, archive], { encoding: 'utf8' })
  assert.equal(bad.status, 1, bad.stdout + bad.stderr)
  assert.match(bad.stdout + bad.stderr, /ASAR payload mismatch: package.json/)
})
