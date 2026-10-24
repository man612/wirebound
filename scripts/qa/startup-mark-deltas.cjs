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
  'uiReadyToFcpMs', 'marksMonotonic'
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
  const probes = events.filter(e => e.event === 'renderer-timing-early' || e.event === 'renderer-root-probe')
  // Prefer a later valid observation rather than treating early -1 as final absence.
  const probeNumber = (name) => {
    for (let i = probes.length - 1; i >= 0; i--) {
      const n = good(probes[i][name])
      if (n !== null) return n
    }
    return null
  }
  const root = [...probes].reverse().find(e => Number.isInteger(e.rootChildren) && e.rootChildren >= 0)
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
    rendererLoadToDomMs: measure(at('did-start-loading'), at('dom-ready')),
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
    marksMonotonic: [entry, commit, ui].every(x => x !== null) ? entry <= commit && commit <= ui : null
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
