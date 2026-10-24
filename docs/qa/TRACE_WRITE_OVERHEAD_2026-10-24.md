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


## Actual Windows QA v4 observation — 2026-10-24

A new **manual QA-only** packaged Electron v1.2.0 executable was assembled under F:\Wirebound-Lab\qa-packages\issue44-trace-overhead-manual-v4\win-unpacked with the freshly compiled instrumented main process and existing known-good Electron runtime. The ASAR payload verifier reported **16 verified, zero failures**, and the expected QA flags/manifest were checked. This is NOT a standard electron-builder/NSIS package. The local checkout's 13 Vitest suites passed **75/75 tests**; Node + web typecheck and production Vite/Electron source build returned **exit 0**.

Two launches, each with its own isolated QA userData/sessionData, APPDATA/LOCALAPPDATA and absolute JSONL path, reached visible main window and a populated React root. Both used QA-only deferred ADB, with no heavy counter sampling or installed Wirebound profile changes:

| Measurement | Slow run | Fast run |
| --- | ---: | ---: |
| Main module first observed | 3,299ms | 38ms |
| Electron app.whenReady | 8,054ms | 160ms |
| Window icon decoding | 1,171ms | 10ms |
| Native BrowserWindow creation | **4,032ms** | 109ms |
| Renderer did-start-loading → DOM ready | **8,266ms** | 398ms |
| Full window shown | **22,406ms** | **838ms** |
| Nonempty React root | Yes | Yes |
| Navigation-relative FCP | Unavailable (-1) | 756ms |
| Largest observed main-loop heartbeat delay | **7,898ms** | None reported |
| Cumulative trace-writer append time at last recorded event | **42.605ms** | **103.483ms** |
| Largest single prior appendFileSync | 25.327ms | 94.407ms |
| Startup harness result | PASS | PASS |

**Interpretation:** The slow run spent only 42.605ms across observed synchronous JSONL appends, compared with 22,406ms until the window was shown. The fast run accumulated **more** append time despite showing its window in 838ms. These measurements strongly suggest that **synchronous trace writes alone are insufficient to explain these specific multi-second stalls**. They do not prove write I/O can never contribute on other runs or devices. Cumulative self-timing is read at the *last* event, which may be later than window-shown, and omits the duration of that last write; it should not be presented as a precisely timed pre-window percentage.

The slow run still had severe delay before main-module first observation and in app.whenReady, native window construction and renderer loading; one heartbeat lag was 7.9 seconds. These stages deserve continued investigation under truly comparable Windows OS/HDD load. No production behavior change or speculative logging rewrite is justified by the observed data.

Raw QA-only traces:
- F:\Wirebound-Lab\benchmarks\issue44-trace-write-cost-20261024\attempt-1\startup.jsonl
- F:\Wirebound-Lab\benchmarks\issue44-trace-write-cost-20261024\attempt-2\startup.jsonl
- F:\Wirebound-Lab\logs\issue44-trace-write-cost-v4.log and issue44-trace-write-overhead-build.log

The source-controlled scripts/qa/startup-phase-report.ps1 now includes traceWriteBeforeShownMs, traceTotalWriteMs, traceMaxWriteMs and navigation-relative first-contentful paint in its results, while remaining compatible with older traces that lack these fields.
