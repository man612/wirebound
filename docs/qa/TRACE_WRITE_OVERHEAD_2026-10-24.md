# QA trace write-overhead investigation — 2026-10-24

Status: isolated instrumentation in Draft PR #51; issue #44 remains open. This document does not claim a traced write is responsible for the startup stalls.

## Reason for checking the profiler itself

The Windows HDD startup study established that app startup can stall across **several phases simultaneously**. On one of the 12 recent icon-crossover starts, the full-size window was shown after **15,669ms**, with bundled window icon decoding 893ms, native BrowserWindow construction 2,781ms, and renderer did-start-loading → dom-ready 6,930ms. The startup trace also contained an event-loop heartbeat delayed by **4,914ms**. The earlier 34,979ms startup showed the same multi-phase long tail. Removing the icon did not consistently help: across 12 samples, normal icon median 515.5ms, QA skip-icon median 551.5ms (all 12 reached React root and window visible).

The existing startup trace appends a JSONL line to disk using synchronous appendFileSync for every event. On this HDD, that disk I/O could itself contribute to delays. It is an **unverified measurement bias**, not a proven root cause.

## Added numeric self-observation

On a valid absolute WIREBOUND_QA_STARTUP_TRACE path, each new trace event includes these additional QA-only numbers:

- tracePreviousWriteMs — how long the immediately preceding appendFileSync operation took.
- traceTotalWriteMs — total synchronous append time *before* the current event.
- traceMaxWriteMs — worst synchronous append time observed *before* the current event.

Values use performance.now() around the actual append, rounded to 0.001ms when written to the next line. Reporting previous rather than current append avoids including a number that could not be known until the line has already been persisted. Therefore the last append is not represented unless a later event is written. This is intentionally diagnostic, not complete profiling of every filesystem call.

The trace still records elapsedMs from process uptime and previously supported minimal event metadata. No event payload, URL, device identity, settings content or filesystem path is added. Ordinary launches with tracing disabled do not perform this new measurement. Errors writing the QA trace are still swallowed so tracing cannot break startup.

## Validation and interpretation

Windows focused and whole-suite tests are required to pass, including numeric metadata in the second written event and no output for disabled/relative trace paths. Build + typecheck and a *real* packaged QA startup are separate gates; unit tests alone are not sufficient to infer on-disk latency during Electron startup. A verified ASAR with the new code is needed before inspecting tracePreviousWriteMs/traceTotalWriteMs/traceMaxWriteMs in startup traces.

For a slow reproduced start, compare the cumulative writer time to elapsed process time. If writer cumulative time is low (e.g. tens of milliseconds) while native creation or renderer waits consume seconds, the synchronous writer is not sufficient to explain those seconds. If any individual append consumes seconds, instrumenting with a different nonblocking writer or moving diagnostic output off the contested drive may be justified, but will require a separate paired experiment. Changes to QA tracing MUST NOT be presented as an installed-app performance fix.

Release/merge still requires official NSIS, real Android USB/ADB/Gnirehtet parity, repeatable cold/warm measurements, and safe failure/shutdown handling. Keep the UI-first mode QA-only and preserve production window icon and cached ADB integrity.
