# Wirebound v1.2.0 — Hands-on Dashboard UX audit

Primary tracking: https://github.com/man612/wirebound/issues/48

**2026-10-20: documented requirements only; implementation not complete.**

# Wirebound v1.2.0 — Dashboard/onboarding UX audit (10 user-reported findings)

**Status:** OPEN — implementation not started as part of this issue.  
**Reported:** 2026-10-20, directly from hands-on testing of local Windows 11 build `1.2.0.0`, with a single USB-connected Motorola moto g45 5G / Android 15.  
**Priority:** release-quality UX follow-up; do not imply these items are already fixed or that passing existing CI means the visual behavior passed.  
**Source:** user supplied two screenshots in ChatGPT. **Do not upload screenshots unchanged** because the device identifier appears in them. Any later screenshots/screenshare or QA report must mask the serial and other identifying information.

## Goals and decision log

The user requests a focused UX/UI revision, **not a wholesale redesign of the Wirebound identity**. Keep the existing dark/light theme, Windows-style layout, current Gnirehtet/ADB reliability work, user settings, accurate connectivity status and genuine TUN RX/TX telemetry. Prioritize important elements (engine and Android device) above rarely needed diagnostic detail. Avoid animated simulations, invented check states, aggressive automatic scrolling, visual-only buttons or losing accurate real device data.

**Important existing product scope:** the maintainer owns one Android phone; physical two-phone simultaneous testing was explicitly waived for v1.2. Continue automated multi-device behavior checks without demanding a second handset or claiming two-phone physical validation. See #38.

## Actual code inspection (main after #47, 2026-10-20)

- `src/renderer/src/components/OnboardingScreen.tsx` has local `theme/setTheme` state; `App.tsx` applies `document.documentElement.dataset.theme` on onboarding completion or later settings changes. This explains missing *instant* Light preview.
- `src/renderer/src/components/views/Dashboard.tsx` contains `logEndRef.current?.scrollIntoView({ behavior: 'smooth' })` in an effect keyed to `[logs]`, scrolling the **dashboard page** when output arrives.
- The Android device list uses `overflow-x-auto` with `<table className="w-full min-w-[920px] ...">`; at the reported window width, horizontal scrolling and native scrollbar are unavoidable.
- The diagnostic device-details JSX has malformed literal separators (`A�` / mojibake in source), and dates use `new Date(...).toLocaleString()` without an explicit UI language/format.
- Diagnostics copy currently uses `navigator.clipboard.writeText`, updates a short-lived `reportCopied` state, and only logs exceptions to DevTools. There is no clear visible toast/error treatment or clipboard fallback.
- Diagnostics and ready banner are always rendered at full size. The diagnostic rerun button already spins the refresh icon while running, **but** lacks the requested panel choreography, step progress feedback and completion acknowledgement. Do not falsely state there is no animation at all.
- The dashboard's `Bersihkan` button invokes `onClearLogs` even if `logs.length === 0`.
- `src/renderer/src/components/views/Settings.tsx` tracks `updateCheck` and `checkingUpdates` but does not record/display the exact last attempt/completion timestamp.
- `src/renderer/src/index.css` already defines a `.custom-scrollbar` style, but the device-list scrolling wrapper does not apply it; the preferred fix is removing horizontal scrolling entirely.
- `src/renderer/src/components/terminal/TerminalLog.tsx` contains a separate scrolling implementation; **the currently rendered dashboard's log is directly in Dashboard.tsx**, so fix the active component instead of an unused duplicate.

## P0 — correctness / broken interactions / disruptive layout

### UX-01 — Onboarding Light/Dark preview not applied immediately

**Repro:** open first-run setup (default Dark), choose Light in appearance step. Selected control changes but UI stays Dark until completing onboarding; the normal Settings screen correctly changes theme later.

**Expected:** changing theme in first-run setup updates the entire live onboarding surface and its background, panels, text, borders and controls immediately. Dark remains the initial default. Completing setup retains chosen theme. Returning to a previous setup step preserves current selection; any cancellation/restart semantics must be deliberate (do not silently persist an unfinished preference).

**Implementation guidance:** connect onboarding selection to the same document-root theme application logic used by `App.tsx`/`useSettings`. Avoid a second source of truth or theme flash when swapping steps. Use existing `data-theme` and `dark` class, not an unrelated styling system. Confirm English and Indonesian labels.

**Acceptance tests:** Dark -> Light -> Dark visually changes immediately; finishing setup persists preference; restart displays persisted choice; accessibility contrast remains usable; no unintended state loss.

### UX-05 — Device diagnostic details corrupted and unreadable

**Repro:** diagnostic details show text like `Motorola moto g45 5G Â· [masked-id] Â· Siap Â· Android 15 / API 35 ...` and timestamp `10/20/2026, 4:41:21 PM`.

**Expected:** remove broken separator characters from source, and replace long unstructured run-on paragraph with compact structured rows/chips: **Device model**, **masked ID**, **ADB state**, **Android version/API**, **Gnirehtet installed**, **VPN active**. Date in Indonesian mode: `20 Okt 2026, 16.41.21` (actual locale rendering may use `:` for time; be consistent); English mode gets an appropriate English locale. Use `Intl.DateTimeFormat` with UI language, 24-hour time for ID. Avoid leaking raw serials in support reports, screen previews or logs.

**Acceptance tests:** no `Â·`, replacement characters or mis-decoded glyphs; data wraps cleanly at smaller window sizes; long model names and missing fields are readable; masked IDs stay masked; ID/EN dates match selected language; timestamps remain accurate.

### UX-10 — Automatic dashboard scroll/jump to terminal on Connect

**Repro:** click `Mulai Koneksi`; new engine logs are emitted, dashboard scrolls/focuses toward terminal, pulling engine status and devices out of view.

**Root cause:** `Dashboard.tsx` effect calls `logEndRef.current?.scrollIntoView({behavior:'smooth'})` on every logs array change.

**Expected:** preserve the *dashboard container* vertical scroll position during connection, log updates, polling, refresh and rerenders. Terminal content may auto-stick to bottom **inside its own scrollable area** only when the user is already reading its bottom; if scrolled up, preserve their place. A manual `Lihat log` affordance may be added. Do not move focus unless user initiated the navigation.

**Acceptance tests:** clicking Connect while at top keeps the engine/devices in view as 20+ log lines arrive; starting/stopping/refreshing does not scroll the dashboard; manually scrolling log up is preserved when more logs arrive; correct behavior with keyboard and on smaller windows.

### UX-06 — Device table overflows horizontally, native scrollbar looks out of place

**Repro:** at about 1008px full window width with sidebar visible, `PERANGKAT ANDROID (1)` has horizontal scrolling and the right-side action buttons disappear out of sight.

**Root cause:** `min-w-[920px]` table inside narrower available content area.

**Preferred design:** responsive **device card/list**, not a 920px fixed-width table. Show phone name/model and ADB/VPN states prominently, with **Connect / Disconnect / Retry** always visible. In a compact second row show masked ID, battery, genuine RX/TX counts and optional Speed Test. On wider windows a compact grid/two-line row is fine. Keep multi-device each as a separate accessible item, with individual action states and errors. Do not silently remove telemetry, disable functionality or confuse ADB ready with active VPN.

**Fallback only:** if a wide table is retained on special layouts, style the scrollbar to existing dark/light `.custom-scrollbar` tokens; provide keyboard access and discoverability. No scrolling is strongly preferred.

**Acceptance tests:** zero horizontal scrollbar at the reported window size, 800–1024px widths, narrow resized window and both themes; all actions accessible; long name and offline/unauthorized/error rows stable; screen reader semantics and focus order sensible; real traffic retains unavailable `--` instead of fabricated values.

### UX-03 — Copy diagnostics gives insufficient success/failure feedback

**Observed:** clicking `Salin Laporan` appears to do nothing. The code *does* attempt copy and briefly toggles label; failures are only sent to console and success is easy to miss.

**Expected:** clear button state `Salin Laporan → Menyalin… → Tersalin` with check icon, plus non-blocking toast/status `Laporan berhasil disalin`; failures display actionable `Gagal menyalin laporan` and keep the button available for retry. Report unavailability should disable the button with an explanation. Respect `navigator.clipboard` security/focus restrictions; consider safe Electron IPC fallback if needed. Preserve privacy masking of serials and sensitive report fields. No toast spam on repeated clicks.

**Acceptance tests:** clipboard contains correct masked report on success; button/toast appear for ~2 seconds and reset; writeText rejection gives visible error; copying disabled without report; no modal or unexpected scroll.

### UX-07 — Clear logs active even when logs are empty

**Repro:** with `Belum ada output log`, `BERSIHKAN` looks clickable.

**Expected:** actual dashboard log Clear button has `disabled={logs.length === 0}`, subdued styles, a discoverable disabled description/tooltip and no click handler effect when empty. It becomes active with one or more entries and disabled again after clearing. Make any alternative TerminalLog component consistent only if it is actually used.

**Acceptance tests:** empty, populated, post-clear, and rapidly arriving logs; keyboard cannot activate empty action; text contrast is still clear.

## P1 — dashboard organization, motion and feedback

### UX-02 — Diagnostics dominates screen; collapsed-by-default with brief initial reveal

**Observed:** six diagnostic cards + a long device report push the Android device list below the fold.

**Design:** compact one-row diagnostic summary by default, `Lihat diagnostik` / `Sembunyikan diagnostik` toggle with chevron and a meaningful count/status (e.g. `6 pemeriksaan • 6 siap` **only** when real results support it). On first entering Dashboard or cold app open, **temporarily expand for about 2–3 s then collapse**, so the user briefly sees the checks and device data rises into view. This must not repeatedly flash on every device poll/re-render. If loading has not finished, show a truthful checking state, not fabricated success.

**Interaction contract:** **manual override wins**. If user clicks expand/collapse, don't auto-collapse against them. Cancel timers on unmount, navigation and rerun; do not change the browser's main scroll position when expanding/collapsing. Respect `prefers-reduced-motion`. Keep diagnostics discoverable at all times.

**Acceptance tests:** initial reveal is brief and once per intended dashboard entry; summary remains useful collapsed; expand and collapse from mouse/keyboard; manual open never closes itself; diagnostic failure may remain open / warn according to a clear severity rule.

### UX-04 — Rerun diagnostics needs visible progress and temporary expansion

**Observed:** `Jalankan Lagi` currently spins the small Refresh icon only while `diagnostics.isRunning`, with little contextual feedback.

**Expected:** clicking rerun from a collapsed diagnostic card automatically opens it, shows a legitimate `Memeriksa…` loading state and tasteful spinner/skeleton/pulse on check items; update each item when **real** results arrive, not a fake step sequence or invented passed checks. On completion show `Pemeriksaan selesai` / genuine error and an accessible announcement. Keep the results visible for ~2–3 s, then collapse **only if the user did not manually interact with the panel**. If the user manually expands during the run, keep it open. Prevent overlapping reruns; handle errors and cancellation.

**Acceptance tests:** rerun collapsed/expanded, slow result, failed result, repeated rapid click, navigation away, manual expansion, reduced motion; no timers leaking after unmount or fake pass status.

### UX-08 — Ready-state banner too tall; dismissible and compact

**Observed:** green `Perangkat siap` message consumes too much vertical space and lacks dismiss action.

**Expected:** compact status strip (often one line at normal desktop width) with icon, short title and concise instruction `Mulai koneksi lalu setujui VPN di Android.`, plus an accessible X button at top/right (`Tutup pemberitahuan`). Dismissal should persist during the current dashboard session, or until **meaningful status transition**; don't reappear on each poll. **Errors and authorization warnings must not be suppressed silently by dismissing a successful ready notice**. Preserve color-independent status indicators and adequate tap/click target.

**Acceptance tests:** compact at 1008px, wraps gracefully narrower, dismiss persists across unrelated polling, serious status changes remain visible, screen readers announce updated status appropriately.

### UX-09 — Updates section needs exact last-check timestamp

**Observed:** Settings → `Periksa Pembaruan` shows `Wirebound sudah versi terbaru` without when the check occurred.

**Expected:** display `Terakhir diperiksa: 20 Okt 2026, 16.46.13` (Indonesian locale) after an **actual** check completes, including date/hour/minute/second. Track distinct last attempt and last successful check when helpful; if a check fails, show `Percobaan terakhir` and failure, never present a failed check as successful. Record actual time, not fabricated static/example data. Prefer persistence across Settings navigation/restart if that makes the status meaningful, but do not trigger a network request just to display history. English locale uses appropriate format.

**Acceptance tests:** correct local timestamp after success; a second check updates it; failure shows failed attempt time (without overwriting past success misleadingly); never-checked state remains explicit; timezone and locale handled; repeated UI navigation doesn't erase result if persistence is chosen.

## Shared UX quality, accessibility and regression requirements

- Design follows Wirebound's existing tokens (BG/border/accent and light/dark), accessible contrast, readable 11–12px minimum where practical, keyboard focus and icon labels.
- Animations are subtle 150–300ms for transitions; **2–3 seconds is the time a temporary diagnostics section remains open, not an artificially delayed backend scan**. Respect `prefers-reduced-motion`.
- Use stable state/timer cleanup; prevent polling, IPC logs or device snapshot updates from resetting user-selected UI state or forcing scroll/focus.
- Store user-visible ID/EN strings in `src/renderer/src/i18n.ts`, not scattered hard-coded untranslated Indonesian strings. Use `Intl.DateTimeFormat` for timestamps, with sane fallbacks when values are invalid.
- Never leak device serials, private diagnostic report contents or crash dumps into CI artifacts/screenshots. Mask ID in screen captures and support reports.
- Test at **1008×650 screenshot-like window**, 800×600, 1280×720 and a narrow resized window; at 100% and 125% Windows scaling if feasible; ID/EN; Light/Dark; zero/one/multiple mocked devices; offline/unauthorized and active VPN statuses.
- Add focused Vitest/component or suitable UI integration coverage and run `npm ci`, lint, typecheck, test, Windows build/package smoke. Physical testing uses the maintainer's **one** Motorola handset only; no second phone required.
- Prefer to implement in small reviewable PRs: **(A) theme/encoding/scroll/log**, **(B) responsive device cards + compact banner**, **(C) diagnostics reveal/rerun/copy feedback**, **(D) update timestamps + translation/polish**. Multiple PRs may be sequenced as needed; maintain a green main branch.
- **Do not** silently publish v1.2.0 or imply this UX audit was already fixed. Current release gate and unsigned distribution policy are tracked in #38. If release numbering has already been bumped, new UX fixes can be integrated before a public tag only with appropriate checks.

## Definition of Done

- [ ] UX-01 onboarding theme preview
- [ ] UX-02 collapsed diagnostics with brief initial reveal and manual override
- [ ] UX-03 copy report feedback/error handling
- [ ] UX-04 rerun progress / auto-reveal / respectful auto-collapse
- [ ] UX-05 correctly encoded structured device details and local date
- [ ] UX-06 responsive Android device layout without horizontal scroll
- [ ] UX-07 disable Clear when logs empty
- [ ] UX-08 compact dismissible ready banner
- [ ] UX-09 precise last-update-check timestamp
- [ ] UX-10 dashboard no longer auto-scrolls to new log lines
- [ ] Tests and screenshots (with serials masked) capture before/after in both themes and ID/EN
- [ ] No regressions to single-device USB/VPN connect → disconnect → retry → stop and genuine TUN traffic counters

**This issue is a specification and audit, not a claim of implementation.**

---

## Maintainer implementation notes

The GitHub issue linked at the top is the canonical live checklist. This copied specification is a dated design baseline; apply future decisions to issue #48 and update this file when implementation materially changes.

Implementation order: P0 theme/encoding/scroll/log actions -> responsive device layout -> diagnostic feedback/collapse/rerun/banner -> exact update-check timestamp and final localization/accessibility QA.

Recommended state model for diagnostics: manual toggle takes precedence over auto-preview timers; rerun opens the panel, uses real asynchronous status and reveals real results; only automatically collapse if the user did not interact manually. On errors keep an actionable, truthful status. Respect prefers-reduced-motion.

Use responsive device cards/two-line rows that display model, ADB readiness, separately confirmed VPN state, masked device ID, battery, actual RX/TX counters, and reachable per-device controls without horizontal scroll. Do not invent internet speed data.

Keep outer dashboard scroll fixed while logs arrive. Scroll only within the log viewport, and only if its reader was near the bottom. Avoid scrollIntoView on each log update.

Run UI visual/manual tests at 800x600, approximately 1008x650, and 1280x720, in both languages and themes, plus mocked offline/unauthorized/multiple-device states. End-to-end physical smoke tests use the one available Moto g45 5G; no second phone is required.

Privacy: the user screenshots contain an Android ID. Redact before adding any image to the public repository, PR, or CI artifact. Keep report IDs masked.

This documentation change does not implement or verify any UX fix.
