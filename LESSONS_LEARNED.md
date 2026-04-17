# Lessons Learned — FlightBoard Redesign

*Captured after the initial build: backend + frontend + kiosk deployment on 1600×900 ASUS.*

This document exists so future-you (or future-Claude, starting a new conversation) can avoid the same time sinks. Read it before starting significant new work on this project.

---

## What worked well

### Writing the spec before writing code
The markdown spec (`FLIGHTBOARD_REDESIGN_SPEC.md`) turned out to be the most important artifact of the whole project. It gave Claude Code a single source of truth, it gave us a build order that produced testable checkpoints, and when mid-session rate limits or fresh chats forced restarts, re-orienting was fast. If we'd started coding immediately after the "vision" questions, we'd have gotten lost by step 3.

### Step-by-step verification
Stopping after each numbered step to test — server logs, curl, browser screenshots — caught every real bug before it piled on top of another one. The "do-many-steps-and-verify-at-the-end" pattern would have made debugging the ticker, the notable detection, and the proxy path all at once. Ugly.

### Committing in phases
Three commits at natural break points (backend done, frontend done, kiosk fit). If something had gone wrong during frontend work, we could have rolled back to just the backend without losing everything.

### Letting real traffic drive tests
The Flexjet that flew over during step 11 proved trails, notable detection, AND featured precedence all at once. Would have taken three synthetic test cases to match that.

---

## What cost us time

### Assuming instead of measuring
The spec was written for 1920×1080 without ever checking the ASUS resolution. It was 1600×900. That cost us a late round of CSS fixes right when we wanted to be done.

**Rule:** measure first, design to the measurement. `DISPLAY=:0 xrandr | head -5` should be step zero of any kiosk project.

### OneDrive and Node don't mix
Moving the project out of OneDrive was obviously right in hindsight. Sync lag, file locking, `node_modules` churn — the friction compounds fast.

**Rule:** active projects live on local disk. Git is the backup, not OneDrive.

### PowerShell encoding quirks
`Set-Content -Encoding UTF8` silently added a BOM that made Node's JSON parser fail on `projects.json`. The dashboard-manager's `try/catch → return []` hid the real error, so the symptom was "no projects appear" instead of a parse error.

**Rule:** on Windows, when writing a JSON config file that something else parses, use:

```powershell
$json = @'
<json content here>
'@
[System.IO.File]::WriteAllText("absolute\path\to\file.json", $json, (New-Object System.Text.UTF8Encoding $false))
```

The `$false` argument explicitly disables the BOM preamble.

### Zombie Node processes
Windows `Ctrl+C` doesn't always fully kill Node. We hit this at least three times — stale server, port-in-use errors, "Cannot GET" mysteries.

**Rule:** if something weird happens after an edit, first reflex is:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
```

Then restart. This kills ALL Node processes on the machine; be aware if you're running multiple Node things simultaneously.

### The trailing slash
The difference between `/app/flightboard` and `/app/flightboard/` wasn't obvious in the spec, but it was the difference between a broken unstyled page and a working display. Relative URLs in HTML (`<base href="./">`) resolve against the current URL's directory. Without the trailing slash, the browser treats the last segment as a file name instead of a folder, so `./style.css` resolves to `/app/style.css` — which doesn't exist.

**Rule:** for proxied apps that use relative URLs, always redirect the no-trailing-slash form to the trailing-slash form at the proxy layer. See `C:\Users\tod\dashboard-manager\server.js` around line 80 for the pattern.

### Mixing AI interfaces mid-build
Switching between Cursor's agent and Claude Code mid-session caused confusion — rate limits, partial work, different memory state. One interface finished a step, the other didn't know about it.

**Rule:** pick one interface per build and stick to it. If you have to switch, reset the new session with a state snapshot of what's done.

---

## Patterns worth reusing

### State snapshot after every phase
Asking Claude Code to summarize "here's what's built, what files changed, what's incomplete" gives you a clean handoff if the session dies. Do this after every 3-4 steps.

### Force tests over wait-for-real-data tests
The notable ticker only fires on notable traffic. We got lucky with a Flexjet, but the smarter approach would have been to add a debug endpoint that injects a fake notable aircraft on-demand. Do this from the start for anything whose test requires a specific world state.

### Build order: skeleton → styling → data → interactions → polish
The order in the spec (empty HTML → CSS → fetch stub → feature by feature → animations) made every step visually verifiable. Don't wire data into empty divs and then discover the CSS is wrong — build the container first, then fill it.

### CSS variables for the whole theme
All the colors, fonts, and spacing went through `var(--name)` from step 6 onward. When we needed to tweak for the 1600×900 screen, it was a few line changes, not a find-and-replace across the codebase. Always do this.

### Viewport units (`vw`/`vh`) beat fixed pixels for kiosks
The fit-to-screen fix used `30vw 40vw 30vw` and `overflow: hidden`. That single pattern means the same code works on any resolution. If it had been the original spec, no step 16 fit pass would have been needed.

### File-based logo cache with sentinel files
The pattern for `/api/logo/:icao` — cache on first hit, write a `{ICAO}.missing` zero-byte file on 404 to prevent repeat external requests — was a nice win. Worth reusing for any external resource that might not always exist.

---

## What to do differently on the next project

1. **Measure the target hardware on day 1.** Resolution, color profile, touch vs mouse, kiosk chrome status. No assumptions.

2. **Set up the dashboard-manager entry on day 1** (with a stub endpoint returning "hello world"). That surfaces proxy/path/URL issues *before* you've built the whole app on top of wrong assumptions.

3. **Add `nodemon` to the dev loop** early. Auto-restart saves minutes per edit.

4. **Keep one PowerShell terminal open.** Multiple terminals confused both of us more than once.

5. **Test on the actual kiosk at step 7-ish**, not step 16. Catching the resolution issue halfway through would have saved the last scramble.

---

## Known deferred work

Not bugs, just things parked for a future session:

- **Route lookup** — "DEN → LAX" currently shows "—" because we never wired up a flight-route data source
- **Auto-restart on flightboard crash** — dashboard-manager marks it Stopped but doesn't respawn
- **Stats persistence** — `dailyStats` lives only in memory; a restart during the day loses the running totals
- **Nodemon in dev** — would save a lot of manual kill-and-restart cycles during future edits
- **Weather overlay** — winds aloft visualization in radar corner
- **Sound effects** — subtle chime when a notable flight appears
