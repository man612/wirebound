#!/usr/bin/env node
'use strict'

// QA-only summary: numeric, privacy-limited milestones from existing JSONL traces.
// Process-relative durations and navigation-relative durations stay in distinct columns.
const fs = require('node:fs')
const path = require('node:path')

const fields = [
  'series', 'attempt', 'traceLines', 'invalidLines', 'shownProcessMs',
  'firstMainProcessMs', 'appReadyProcessMs', 'beforeAppReadyMs',
  'adbFingerprintMs', 'nativeWindowCtorMs', 'rendererLoadToDomMs',
  'rootProbeProcessMs', 'rootChildren', 'rootVisible',
  'responseEndNavMs', 'domInteractiveNavMs', 'entryEvaluatedNavMs',
  'reactFirstCommitNavMs', 'uiSettingsReadyNavMs',
  'firstPaintNavMs', 'fcpNavMs', 'responseToDomInteractiveMs',
  'domInteractiveToEntryMs', 'entryToReactCommitMs', 'reactCommitToUiReadyMs',
  'uiReadyToFcpMs', 'marksMonotonic',
  'heartbeatSamples', 'maxHeartbeatDelayMs', 'cpuUserMsAtMaxLag',
  'cpuSystemMsAtMaxLag', 'cpuSampledHeartbeats'
]

function measure(a, b) {
  return Number.isFinite(a) && Number.isFinite(b) ? b - a : null
}
function good(n) { return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null }
function summarizeTrace(input, series, attempt) {
  const lines = input.split(/\r?\n/).filter(Boolean)
  const events = []
  let invalidLines = 0
  for (const line of lines) {
    try {
      const event = JSON.parse(line)
      if (typeof event.event !== 'string') throw new Error('invalid event')
      events.push(event)
    } catch { invalidLines++ }
  }
  const first = (name) => events.find(e => e.event === name)
  const at = (name) => good(first(name)?.elapsedMs)
  // A later renderer navigation has its own performance.timeOrigin and marks.
  // Never join old-page FCP/UI-ready with new-page ESM/React measurements.
  // Legacy test traces without did-start-loading retain their existing behavior.
  const lastLoadIndex = events.findLastIndex(e => e.event === 'did-start-loading')
  const currentNavigation = lastLoadIndex < 0 ? events : events.slice(lastLoadIndex + 1)
  const probes = currentNavigation.filter(e =>
    e.event === 'renderer-timing-early' || e.event === 'renderer-root-probe'
  )
  // Prefer a later valid observation rather than treating early -1 as final absence.
  const probeNumber = (name) => {
    for (let i = probes.length - 1; i >= 0; i--) {
      const n = good(probes[i][name])
      if (n !== null) return n
    }
    return null
  }
  const root = [...probes].reverse().find(e => Number.isInteger(e.rootChildren) && e.rootChildren >= 0)
  const heartbeats = events.filter(e => e.event === 'main-loop-heartbeat')
  const measuredDelays = heartbeats.filter(e => good(e.delayMs) !== null)
  const slowestHeartbeat = measuredDelays.reduce((slowest, next) => (
    !slowest || next.delayMs > slowest.delayMs ? next : slowest
  ), null)
  const cpuSampledHeartbeats = heartbeats.filter(e =>
    good(e.cpuUserMs) !== null && good(e.cpuSystemMs) !== null
  ).length
  const [response, dom, entry, commit, ui, paint, fcp] = [
    'responseEndMs', 'domInteractiveMs', 'entryEvaluatedMs',
    'reactFirstCommitMs', 'uiSettingsReadyMs', 'firstPaintMs',
    'firstContentfulPaintMs'
  ].map(probeNumber)
  return {
    series, attempt, traceLines: lines.length, invalidLines,
    shownProcessMs: at('window-shown'),
    firstMainProcessMs: at('main-module-start'),
    appReadyProcessMs: at('app-when-ready'),
    beforeAppReadyMs: measure(at('main-module-start'), at('app-when-ready')),
    adbFingerprintMs: measure(at('adb-cache-fingerprint-start'), at('adb-cache-fingerprint-ready')),
    nativeWindowCtorMs: measure(at('window-creating'), at('window-created')),
    // Match the latest load start with DOM readiness from that SAME navigation.
    // A second load without dom-ready must remain unavailable, not borrow an
    // earlier success or report a duration spanning two different loads.
    rendererLoadToDomMs: lastLoadIndex < 0 ? null : measure(
      good(events[lastLoadIndex].elapsedMs),
      good(currentNavigation.find(e => e.event === 'dom-ready')?.elapsedMs)
    ),
    rootProbeProcessMs: good(root?.elapsedMs),
    rootChildren: Number.isInteger(root?.rootChildren) ? root.rootChildren : null,
    rootVisible: typeof root?.visible === 'boolean' ? root.visible : null,
    responseEndNavMs: response, domInteractiveNavMs: dom, entryEvaluatedNavMs: entry,
    reactFirstCommitNavMs: commit, uiSettingsReadyNavMs: ui,
    firstPaintNavMs: paint, fcpNavMs: fcp,
    responseToDomInteractiveMs: measure(response, dom),
    domInteractiveToEntryMs: measure(dom, entry),
    entryToReactCommitMs: measure(entry, commit),
    reactCommitToUiReadyMs: measure(commit, ui),
    uiReadyToFcpMs: measure(ui, fcp),
    marksMonotonic: [entry, commit, ui].every(x => x !== null) ? entry <= commit && commit <= ui : null,
    heartbeatSamples: heartbeats.length,
    maxHeartbeatDelayMs: good(slowestHeartbeat?.delayMs),
    // CPU values belong to the *same heartbeat interval* as its worst lag.
    // They measure the Electron main process only (not Chromium child CPU).
    cpuUserMsAtMaxLag: good(slowestHeartbeat?.cpuUserMs),
    cpuSystemMsAtMaxLag: good(slowestHeartbeat?.cpuSystemMs),
    cpuSampledHeartbeats
  }
}

function formatCSV(rows) {
  const cell = (v) => {
    if (v === null || v === undefined) return ''
    const text = String(v)
    return /[,\r\n"]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
  }
  return [fields.join(','), ...rows.map(r => fields.map(f => cell(r[f])).join(','))].join('\n') + '\n'
}
function loadRoot(root) {
  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^attempt-\d+$/.test(d.name))
    .sort((a, b) => Number(a.name.slice(8)) - Number(b.name.slice(8)))
  return dirs.filter(d => fs.existsSync(path.join(root, d.name, 'startup.jsonl')))
    .map(d => summarizeTrace(fs.readFileSync(path.join(root, d.name, 'startup.jsonl'), 'utf8'),
      path.basename(root), d.name))
}
if (require.main === module) {
  const roots = process.argv.slice(2)
  if (roots.length === 0) {
    console.error('Usage: node startup-mark-deltas.cjs <QA-attempt-directory> [another-directory...]')
    process.exitCode = 2
  } else {
    try {
      const rows = roots.flatMap(loadRoot)
      if (!rows.length) throw new Error('No valid startup.jsonl files found in attempt directories')
      process.stdout.write(formatCSV(rows))
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
}
module.exports = { summarizeTrace, formatCSV, loadRoot }
