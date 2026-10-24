'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { summarizeTrace, formatCSV, loadRoot } = require('./startup-mark-deltas.cjs')
const line = (event, elapsedMs, rest = {}) => JSON.stringify({ event, elapsedMs, ...rest })
test('separates process and Chromium navigation clock durations', () => {
  const input = [
    line('main-module-start', 20), line('app-when-ready', 50),
    line('window-creating', 80), line('window-created', 95),
    line('did-start-loading', 100), line('dom-ready', 220), line('window-shown', 230),
    line('renderer-root-probe', 260, {
      rootChildren: 1, visible: true, responseEndMs: 25, domInteractiveMs: 105,
      entryEvaluatedMs: 120, reactFirstCommitMs: 130, uiSettingsReadyMs: 150,
      firstPaintMs: 140, firstContentfulPaintMs: 185
    })
  ].join('\n')
  const r = summarizeTrace(input, 'qa', 'attempt-1')
  assert.equal(r.shownProcessMs, 230)
  assert.equal(r.beforeAppReadyMs, 30)
  assert.equal(r.nativeWindowCtorMs, 15)
  assert.equal(r.rendererLoadToDomMs, 120)
  assert.equal(r.responseToDomInteractiveMs, 80)
  assert.equal(r.domInteractiveToEntryMs, 15)
  assert.equal(r.entryToReactCommitMs, 10)
  assert.equal(r.reactCommitToUiReadyMs, 20)
  assert.equal(r.uiReadyToFcpMs, 35)
  assert.equal(r.marksMonotonic, true)
})
test('later valid FCP overrides unavailable early probe', () => {
  const input = [
    line('renderer-timing-early', 400, { rootChildren: 1, firstContentfulPaintMs: -1 }),
    line('renderer-root-probe', 2000, { rootChildren: 1, visible: true, firstContentfulPaintMs: 300 })
  ].join('\n')
  const r = summarizeTrace(input, 'qa', 'attempt-1')
  assert.equal(r.fcpNavMs, 300)
  assert.equal(r.rootVisible, true)
  assert.equal(r.responseToDomInteractiveMs, null)
})
test('incomplete and damaged JSONL remains explicitly unavailable', () => {
  const r = summarizeTrace([line('main-module-start', 15), '{"broken":'].join('\n'), 'qa', 'attempt-1')
  assert.equal(r.invalidLines, 1)
  assert.equal(r.rootChildren, null)
  assert.equal(r.fcpNavMs, null)
  assert.equal(r.marksMonotonic, null)
  assert.equal(r.shownProcessMs, null)
  assert.ok(!formatCSV([r]).includes('NaN'))
})
test('out-of-order renderer marks are flagged rather than reordered', () => {
  const r = summarizeTrace(line('renderer-root-probe', 500, {
    entryEvaluatedMs: 120, reactFirstCommitMs: 110, uiSettingsReadyMs: 180
  }), 'qa', 'attempt-1')
  assert.equal(r.marksMonotonic, false)
  assert.equal(r.entryToReactCommitMs, -10)
})
test('reads only numbered attempt folders in numeric order', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wirebound-startup-deltas-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const n of [10, 2]) {
    const dir = path.join(root, 'attempt-' + n)
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'startup.jsonl'), line('window-shown', n), 'utf8')
  }
  const rows = loadRoot(root)
  assert.deepEqual(rows.map(r => r.attempt), ['attempt-2', 'attempt-10'])
  assert.deepEqual(rows.map(r => r.shownProcessMs), [2, 10])
})

test('associates CPU readings only with the actual worst delayed heartbeat', () => {
  const input = [
    line('main-loop-heartbeat', 1500, { tick: 1, delayMs: 500, cpuUserMs: 55, cpuSystemMs: 9 }),
    line('main-loop-heartbeat', 7700, { tick: 2, delayMs: 5200, cpuUserMs: 21, cpuSystemMs: 2 }),
    line('main-loop-heartbeat', 9000, { tick: 3, delayMs: 300, cpuUserMs: 17, cpuSystemMs: 1 })
  ].join('\n')
  const r = summarizeTrace(input, 'qa', 'attempt-1')
  assert.equal(r.heartbeatSamples, 3)
  assert.equal(r.cpuSampledHeartbeats, 3)
  assert.equal(r.maxHeartbeatDelayMs, 5200)
  assert.equal(r.cpuUserMsAtMaxLag, 21)
  assert.equal(r.cpuSystemMsAtMaxLag, 2)
})

test('legacy heartbeat without CPU readings retains the gap but not invented CPU', () => {
  const input = line('main-loop-heartbeat', 6000, { tick: 2, delayMs: 3800 })
  const r = summarizeTrace(input, 'qa', 'attempt-1')
  assert.equal(r.heartbeatSamples, 1)
  assert.equal(r.cpuSampledHeartbeats, 0)
  assert.equal(r.maxHeartbeatDelayMs, 3800)
  assert.equal(r.cpuUserMsAtMaxLag, null)
  assert.equal(r.cpuSystemMsAtMaxLag, null)
  assert.equal(summarizeTrace(line('window-shown', 900), 'qa', 'attempt-2').maxHeartbeatDelayMs, null)
  assert.equal(formatCSV([r]).includes('undefined'), false)
})

test('does not mix renderer milestones across separate navigations', () => {
  const input = [
    line('did-start-loading', 100),
    line('dom-ready', 200),
    line('renderer-root-probe', 250, {
      rootChildren: 1, visible: true,
      entryEvaluatedMs: 90, reactFirstCommitMs: 110,
      uiSettingsReadyMs: 120, firstContentfulPaintMs: 130
    }),
    line('did-start-loading', 500),
    line('dom-ready', 600),
    line('renderer-root-probe', 650, {
      rootChildren: 1, visible: true,
      entryEvaluatedMs: 40, reactFirstCommitMs: 60,
      uiSettingsReadyMs: -1, firstContentfulPaintMs: -1
    })
  ].join('\n')
  const r = summarizeTrace(input, 'qa', 'attempt-1')
  assert.equal(r.rendererLoadToDomMs, 100)
  assert.equal(r.entryEvaluatedNavMs, 40)
  assert.equal(r.reactFirstCommitNavMs, 60)
  assert.equal(r.uiSettingsReadyNavMs, null)
  assert.equal(r.fcpNavMs, null)
  assert.equal(r.reactCommitToUiReadyMs, null)
  assert.equal(r.marksMonotonic, null)
  assert.ok(!formatCSV([r]).includes('NaN'))
})

test('unfinished new navigation cannot borrow previous dom-ready or UI marks', () => {
  const input = [
    line('did-start-loading', 100),
    line('dom-ready', 200),
    line('renderer-root-probe', 250, {
      rootChildren: 1, entryEvaluatedMs: 90,
      reactFirstCommitMs: 110, uiSettingsReadyMs: 120
    }),
    line('did-start-loading', 500)
  ].join('\n')
  const r = summarizeTrace(input, 'qa', 'attempt-1')
  assert.equal(r.rendererLoadToDomMs, null)
  assert.equal(r.rootChildren, null)
  assert.equal(r.entryEvaluatedNavMs, null)
  assert.equal(r.uiSettingsReadyNavMs, null)
  assert.equal(r.shownProcessMs, null)
})
