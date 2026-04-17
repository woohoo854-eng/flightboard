# FlightBoard Redesign — Build Spec (v2)

**Target display:** ASUS PT2001 27" touchscreen (1920x1080 landscape)
**Target machine:** Lenovo at `192.168.1.3` — Windows, Node v24.14.0
**Project folder:** `C:\Users\tod\flightboard`
**Dashboard-manager folder:** `C:\Users\tod\dashboard-manager` (already built and running on port 3000)
**FlightBoard port:** 3001
**Kiosk access URL:** `http://192.168.1.3:3000/app/flightboard` (via dashboard-manager proxy)
**Direct dev URL:** `http://192.168.1.3:3001` (for testing without the proxy)
**Aesthetic:** Passive, glanceable, cockpit night-mode. Looks cool from across the room.

---

## 0. Critical architecture note — read this FIRST

The dashboard-manager on port 3000 proxies `/app/flightboard/*` → `http://localhost:3001/*`, stripping the `/app/flightboard` prefix before forwarding.

**What that means in practice:**

When the kiosk loads `http://192.168.1.3:3000/app/flightboard`, the browser's base URL is that path. An HTML tag like `<script src="/app.js">` resolves to `http://192.168.1.3:3000/app.js` — which the dashboard-manager does not proxy and will 404.

### The rule: every URL in the frontend must be relative.

Pick ONE of these two approaches and use it consistently:

**Option A (recommended): `<base href>` tag in index.html**

```html
<head>
  <meta charset="UTF-8">
  <base href="./">
  <link rel="stylesheet" href="style.css">
  <title>FlightBoard</title>
</head>
<body>
  <!-- ... -->
  <script src="app.js" defer></script>
</body>
```

Then every `fetch()` uses a bare path:

```js
fetch('api/aircraft')          // ✅ resolves correctly under proxy
fetch('api/logo/UAL')          // ✅
fetch('/api/aircraft')         // ❌ breaks under proxy
```

**Option B: no base tag, but every URL starts with `./`**

```html
<link rel="stylesheet" href="./style.css">
<script src="./app.js" defer></script>
```
```js
fetch('./api/aircraft')
```

Option A is safer — forgetting a `./` in Option B silently breaks one resource.

### Server-side Express routes stay absolute

Inside `server.js`, keep routes like `app.get('/api/aircraft', ...)` — the proxy strips the prefix BEFORE Express sees the request. The proxy rewrite is fully transparent to server code.

### Applies to ALL frontend assets

- Fonts in `@font-face` CSS: `url('fonts/Inter-Regular.woff2')` — not `/fonts/...`
- Logo images in HTML or JS: `assets/logos/UAL.png` — not `/assets/...`
- Plane icon SVG rasterization source: relative path

---

## 1. What's changing and what's not

### Keep as-is
- `server.js` backbone — OpenSky polling, OAuth handling, aircraft CSV lookups, airline ICAO→IATA map all stay
- `.env` — OpenSky `CLIENT_ID` / `CLIENT_SECRET`
- `data/aircraftDatabase.csv` and `data/icao-iata-map.json`
- `package.json` dependencies
- Port 3001
- Home coordinates: `HOME_LAT = 39.8028`, `HOME_LON = -105.0875`

### Rewrite completely
- `public/index.html` — new layout structure
- `public/style.css` — 1920x1080 landscape, dark cockpit theme
- `public/app.js` — multi-aircraft rendering, radar canvas, rotated plane icons, featured-flight rotation

### Extend in server.js
- Add `/api/aircraft` endpoint returning all aircraft in range
- Add `/api/logo/:icao` endpoint with local file cache
- Add notable-flight detection
- Tighten bounding box to ~10mi around Arvada (current is ~23 × 27mi)

### Add to filesystem
- `public/fonts/` — Inter + JetBrains Mono woff2 files
- `public/assets/logos/` — airline logo cache, populated at runtime
- `data/notable-rules.json` — configurable notable-flight rules

---

## 2. Backend changes

### 2.1 Tighten the bounding box

Current box in `server.js`:
```js
const BBOX = {
  lamin: 39.591,
  lamax: 40.014,   // ~23 mi tall
  lomin: -105.326,
  lomax: -104.826  // ~27 mi wide
};
```

Change to ~10 mi radius around Arvada with a 2mi buffer so aircraft don't pop in/out at the edges:

```js
// 12 mi buffer around Arvada (10mi display range + 2mi headroom)
// 1 deg lat ≈ 69 mi, 1 deg lon at 39.8°N ≈ 53 mi
const HOME_LAT = 39.8028;
const HOME_LON = -105.0875;
const BUFFER_MI = 12;
const LAT_BUFFER = BUFFER_MI / 69;                                      // ~0.174
const LON_BUFFER = BUFFER_MI / (69 * Math.cos(HOME_LAT * Math.PI/180)); // ~0.226

const BBOX = {
  lamin: HOME_LAT - LAT_BUFFER,
  lamax: HOME_LAT + LAT_BUFFER,
  lomin: HOME_LON - LON_BUFFER,
  lomax: HOME_LON + LON_BUFFER
};
```

### 2.2 New endpoint: `GET /api/aircraft`

Returns ALL aircraft currently within 10 miles of Arvada.

**Response shape:**
```json
{
  "location": { "lat": 39.8028, "lon": -105.0875, "name": "Arvada CO" },
  "rangeMiles": 10,
  "count": 3,
  "timestamp": 1713456789,
  "featured": "a1b2c3",
  "aircraft": [
    {
      "icao24": "a1b2c3",
      "callsign": "UAL2471",
      "lat": 39.85,
      "lon": -105.12,
      "altitude": 34000,
      "velocity": 485,
      "heading": 247,
      "verticalRate": -128,
      "onGround": false,
      "distanceMi": 4.2,
      "bearing": 312,
      "origin_country": "United States",
      "registration": "N37534",
      "manufacturer": "Boeing",
      "model": "737-924",
      "typecode": "B739",
      "airlineIcao": "UAL",
      "airlineIata": "UA",
      "airlineName": "United Airlines",
      "notable": false,
      "notableReason": null
    }
  ]
}
```

Unit conversions from OpenSky raw data:
- `velocity` in knots (from m/s: × 1.94384)
- `altitude` in feet (from meters: × 3.28084)
- `verticalRate` in feet-per-minute (from m/s: × 196.85)
- `distanceMi` — great-circle distance from Arvada, 1 decimal precision
- `bearing` — compass bearing FROM Arvada TO the aircraft (0–360°)
- Only include aircraft with `distanceMi <= 10` and `onGround === false`
- Sort ascending by `distanceMi` (closest first)

### 2.3 Featured-flight rotation

- **Default:** the closest aircraft (first in the sorted list)
- **Rotation:** every 20 seconds, advance to the next aircraft in the sorted list; wrap around to the start
- **If the current featured aircraft leaves range:** immediately switch to the new closest
- **Server-side state:** track `{ featuredIcao, featuredSince }` so every client sees the same featured flight
- Return the currently-featured aircraft's `icao24` in the top-level `featured` field

### 2.4 Notable-flight detection

Load rules from `data/notable-rules.json` on startup:

```json
{
  "typeCodePrefixes": {
    "widebody": ["B74", "B77", "B78", "A35", "A38", "A33", "A34"],
    "privateJet": ["GL", "G5", "G6", "CL", "C68", "C75", "F2T", "F7X", "F8X", "LJ", "E50", "E55"],
    "cargo": ["B74F", "B74D", "AN12", "AN22", "AN24", "C5", "C17"]
  },
  "specialRegistrations": {
    "N747BA": "Boeing Dreamlifter",
    "N905NA": "NASA Shuttle Carrier",
    "N911NA": "NASA Shuttle Carrier"
  },
  "altitudeThresholdFt": 40000,
  "verticalRateThresholdFpm": 3000
}
```

For each aircraft, set `notable: true` and populate `notableReason` on first match (check in this order):
- `typecode` starts with any `widebody` prefix → `"Wide-body long-haul"`
- `typecode` starts with any `privateJet` prefix → `"Private jet"`
- `typecode` starts with any `cargo` prefix → `"Cargo / special"`
- `registration` matches a `specialRegistrations` key → that key's value
- `altitude > altitudeThresholdFt` → `"High altitude"`
- `Math.abs(verticalRate) > verticalRateThresholdFpm` → `"Aggressive climb/descent"`

### 2.5 Logo cache endpoint: `GET /api/logo/:icao`

- If `public/assets/logos/{ICAO}.png` exists, stream it back
- Otherwise fetch from `https://content.airhex.com/content/logos/airlines_{ICAO}_200_200_s.png`
- Save the bytes to `public/assets/logos/{ICAO}.png`
- Stream the response back
- On 404 from airhex, write a zero-byte sentinel `{ICAO}.missing` so we don't retry every request. If the sentinel exists, return 404 immediately.
- Cache forever — airline logos don't change

### 2.6 Keep existing `/api/flight` endpoint

Don't delete it. Mark with a comment: `// DEPRECATED: kept for bar-screen compatibility, safe to remove once no clients call it.`

### 2.7 Refresh cadence

- OpenSky polling every 5 seconds (existing cadence)
- Frontend polls `api/aircraft` every 5 seconds
- Server caches the last response for 5 seconds so multiple clients share one OpenSky call

---

## 3. Frontend layout (1920x1080)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TOP BAR — 60px                                                         │
│  Arvada CO  ·  ● LIVE  ·  3 aircraft in range        14:32:07 MDT       │
├────────────────┬──────────────────────────────────┬─────────────────────┤
│                │                                  │                     │
│  FEATURED      │         LIVE RADAR               │    COMPASS          │
│  FLIGHT        │                                  │                     │
│  (580px)       │         (760px)                  │    (580px)          │
│                │                                  │                     │
│  airline logo  │    concentric 2.5/5/10 mi        │    large rose       │
│  callsign      │    rings, plane icons rotated    │    featured flight  │
│  route         │    to heading                    │    heading readout  │
│  altitude      │    Arvada = amber triangle       │                     │
│  speed         │    at center                     │    HDG 247°         │
│  aircraft type │                                  │                     │
│  distance      │                                  │                     │
│                │                                  │                     │
├────────────────┴──────────────────────────────────┴─────────────────────┤
│  NOTABLE FLIGHT TICKER — 80px (slides in when active)                   │
│  ⚑ N747BA · Boeing Dreamlifter · heading east · 32,000 ft · 6.1 mi SE   │
└─────────────────────────────────────────────────────────────────────────┘
```

### CSS Grid structure
```css
#dashboard {
  display: grid;
  grid-template-columns: 580px 760px 580px;
  grid-template-rows: 60px 1fr 0px;
  gap: 8px;
  padding: 8px;
  width: 100vw;
  height: 100vh;
  background: var(--bg-base);
  transition: grid-template-rows 400ms ease;
}
#dashboard.ticker-active { grid-template-rows: 60px 1fr 80px; }
#topbar { grid-column: 1 / -1; }
#ticker { grid-column: 1 / -1; }
```

---

## 4. Visual design — cockpit night mode

### Color palette
```css
:root {
  --bg-base:          #0a0a0c;
  --bg-panel:         #121318;
  --bg-panel-alt:     #161820;
  --border-subtle:    rgba(255,255,255,0.06);
  --border-accent:    rgba(255,255,255,0.10);

  --text-primary:     #e8eaed;
  --text-secondary:   #8a8f98;
  --text-dim:         #555962;

  --accent-amber:     #ffb347;
  --accent-amber-dim: rgba(255,179,71,0.25);
  --accent-cyan:      #5fd3e0;
  --accent-cyan-dim:  rgba(95,211,224,0.25);
  --accent-red:       #ff5c5c;

  --live-green:       #4ade80;
}
```

### Typography
- **Sans:** Inter (weights 400, 500, 600) — labels, route, aircraft type
- **Mono:** JetBrains Mono (weight 500) — callsign, altitude, speed, heading, clock
- Both loaded from `public/fonts/` — no CDN, works offline

**Download the woff2 files from:**
- Inter: https://rsms.me/inter/download/ — grab `InterVariable.woff2` or individual weights
- JetBrains Mono: https://www.jetbrains.com/lp/mono/ — use `JetBrainsMono-Medium.woff2`

Font size ladder:
| Element | Size | Weight | Font |
|---|---|---|---|
| Callsign (featured) | 72px | 500 | Mono |
| Route | 42px | 500 | Sans |
| Altitude / speed values | 56px | 500 | Mono |
| Stat labels (ALT, SPD, HDG) | 14px | 500 | Sans, uppercase, letter-spacing 0.15em |
| Aircraft type | 20px | 400 | Sans |
| Compass HDG readout | 64px | 500 | Mono |
| Top bar | 22px | 500 | Sans (mono for clock) |
| Ticker | 28px | 500 | Sans |

### Panel style
- `background: var(--bg-panel)`
- `border: 1px solid var(--border-subtle)`
- `border-radius: 8px`
- No box-shadow
- Inner padding: 32px

---

## 5. Radar panel — centerpiece

### Canvas setup
- `<canvas id="radar">` fills its grid cell minus padding
- Handle `devicePixelRatio` for crisp rendering
- Redraw on every data tick plus animation frames for the sweep

### Draw order (back to front)
1. **Backdrop** — `--bg-panel-alt` fill
2. **Range rings** — 2.5 / 5 / 10 mi
   - Stroke `rgba(95,211,224,0.15)`, 1px, dashed `[4, 6]`
   - Distance labels at top of each ring in 11px mono `--text-dim`
3. **Cardinal grid** — N-S and E-W lines at 8% opacity cyan
4. **Cardinal labels** — N / S / E / W just inside outer ring, 14px sans uppercase
5. **Radar sweep** (decorative only) — 12° conic wedge rotating clockwise, 6s period, `rgba(95,211,224,0.04)`
6. **Aircraft trails** — last 5 positions as fading polyline per aircraft
7. **Aircraft icons** — see below
8. **Arvada marker** — amber triangle at center, "ARVADA" label below

### Plane icon
Define once as a 20×20 SVG path, rasterize to an offscreen canvas on init. Path (pointing up from center):
```
M 10 2 L 14 12 L 12 12 L 12 16 L 10 15 L 8 16 L 8 12 L 6 12 Z
```

For each aircraft:
1. Project lat/lon → canvas x/y
2. Translate, rotate by `heading` (clockwise from north)
3. Scale: 1.0 for others, 1.4 for featured
4. Fill: `--accent-cyan` for others, `--accent-amber` for featured
5. 1px outline in `--bg-panel-alt` so icons pop off trails
6. Callsign label below (10px mono `--text-dim` others, 14px mono `--accent-amber` featured)

### Projection math
```js
const ARVADA = { lat: 39.8028, lon: -105.0875 };
const RANGE_MI = 10;
const MI_PER_DEG_LAT = 69.0;
const MI_PER_DEG_LON = 69.0 * Math.cos(ARVADA.lat * Math.PI / 180);

function project(lat, lon, canvasSize) {
  const dxMi = (lon - ARVADA.lon) * MI_PER_DEG_LON;
  const dyMi = (lat - ARVADA.lat) * MI_PER_DEG_LAT;
  const pxPerMi = (canvasSize / 2) / RANGE_MI;
  return {
    x: canvasSize / 2 + dxMi * pxPerMi,
    y: canvasSize / 2 - dyMi * pxPerMi  // flip y so north is up
  };
}
```

---

## 6. Featured flight panel

### Layout (top to bottom)
1. **Airline logo** — 200px tall, auto width, centered. Fallback to 80px mono ICAO code if logo missing.
2. **Callsign** — 72px mono, amber
3. **Route** — 42px sans, `DEN → LAX` (em-dash if unknown)
4. **Divider** — 1px `--border-subtle`
5. **2×2 stat grid** — ALT, SPD, DIST, TYPE (label 14px uppercase, value 56px mono below, except TYPE which is 20px sans)
6. **Bottom caption** — 14px `--text-dim`: `Last seen 3s ago · N37534`

### Climb/descent indicator
Next to altitude, show when `|verticalRate| > 100 fpm`:
- `▲` green if climbing
- `▼` red if descending
- nothing if level

### Rotation crossfade
When `featured` changes in API response:
1. Fade panel content to opacity 0 over 400ms
2. Swap DOM
3. Fade back in over 400ms with a 20px upward slide

### Logo fetch
On first encounter of an airline ICAO, fetch `api/logo/{ICAO}` (relative URL). Server handles airhex fetch and caching. On 404, hide logo and show ICAO code instead.

---

## 7. Compass panel

### Elements
1. **Compass rose** — 400px diameter, centered
   - Outer ring: 1px `--border-accent`
   - N/E/S/W: 24px mono `--text-primary`
   - NE/SE/SW/NW: 16px mono `--text-secondary`
   - Degree ticks every 10°: 1% opacity white
2. **Heading needle** — 180px × 20px amber triangle rotating from center
   - `transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)`
3. **Center hub** — 24px circle, `--bg-panel` fill, 2px amber border
4. **Below the rose:**
   - `HDG` label — 14px uppercase `--text-secondary`
   - Numeric value — 64px mono amber, `247°`
   - Cardinal — 20px sans `--text-primary`, `WSW`

### Heading-to-cardinal
```js
function headingToCardinal(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                'S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}
```

---

## 8. Top bar

Flex row, `justify-content: space-between`, padded 24px horizontal.

- **Left:** `Arvada CO` — 22px sans, weight 500
- **Center:** green dot + `LIVE` + ` · ` + `3 aircraft in range`
- **Right:** Clock — 22px mono, updates every 1s, format `HH:MM:SS MDT`

Pulse animation:
```css
@keyframes livePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(1.2); }
}
#live-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--live-green);
  animation: livePulse 2s infinite;
}
```

---

## 9. Notable flight ticker

- Hidden by default: grid row 3 at `0px`, content at `opacity: 0`
- When API response contains an aircraft with `notable: true` (different from currently-shown):
  - Add `.ticker-active` class to `#dashboard` (animates row to 80px)
  - Fade in content over 200ms with 20px slide up
- Format: `⚑ {registration||callsign} · {model} · {notableReason} · {altitude} ft · {distanceMi} mi {bearingCardinal}`
- Left accent: 4px solid `--accent-red`
- Background: `rgba(255, 92, 92, 0.04)`
- Text: 28px sans `--text-primary`, flag glyph in `--accent-red`
- Auto-dismisses 30s after notable flight leaves range

---

## 10. Data flow

- Frontend `setInterval(() => fetch('api/aircraft'), 5000)`
- Clock updates every 1s client-side, no server call
- Featured flight is server-driven via the `featured` field
- Client keeps a `Map<icao24, Position[]>` for trails, last 5 positions per aircraft, evict on range-exit
- On fetch failure, keep last-known data visible for 30s before falling back to "Skies clear"

---

## 11. No-flights state

When `aircraft.length === 0`:
- Radar: rings + Arvada marker + centered text `Skies clear over Arvada` in 24px sans `--text-secondary`
- Featured panel: static Arvada block — `ARVADA, CO` 56px sans, `39.80°N 105.09°W · Elev 5,351 ft` 18px mono below
- Compass: needle hidden (`opacity: 0`), HDG readout `—`
- Top bar: `0 aircraft in range`
- Ticker hidden

Looks intentional, not broken.

---

## 12. Build order for Claude Code

Each step produces something testable. **Stop and verify after each step** before moving on.

1. **Backend: tighten bounding box** per §2.1. Watch server logs to confirm Poll counts still reasonable.
2. **Backend: add `/api/aircraft`** with full response shape. Test with `curl http://localhost:3001/api/aircraft` — should return JSON with aircraft array.
3. **Backend: logo cache endpoint** `/api/logo/:icao`. Test in browser: `http://localhost:3001/api/logo/UAL` returns a PNG. Check `public/assets/logos/UAL.png` was created.
4. **Backend: notable detection** using `data/notable-rules.json`. Log flagged aircraft.
5. **Frontend: HTML skeleton** — new `index.html` with `<base href="./">`, all grid zones empty. Renders as dark panels.
6. **Frontend: CSS variables, panel styles, typography** — load Inter and JetBrains Mono. Panels look right even with no data.
7. **Frontend: top bar** — clock + live indicator + aircraft count. Hooked to `api/aircraft`.
8. **Frontend: featured flight panel** — logo + callsign + route + 4 stats. Verify 20s rotation.
9. **Frontend: radar static elements** — rings, cardinal lines, Arvada marker. No aircraft yet.
10. **Frontend: aircraft on radar** — projected lat/lon, rotated plane icons. Magic moment.
11. **Frontend: aircraft trails** — client-side position history, fading polylines.
12. **Frontend: compass panel** — rose, rotating needle, numeric readout.
13. **Frontend: notable ticker** — slide-in when API flags one.
14. **Polish** — radar sweep animation, featured-flight crossfade, no-flights state.
15. **Add to dashboard-manager** — edit `C:\Users\tod\dashboard-manager\projects.json` (see §14), restart manager.
16. **Kiosk test** — load `http://192.168.1.3:3000/app/flightboard` on the ASUS Chromium kiosk. Verify full 1920x1080 rendering.

---

## 13. File tree (end state)

```
C:\Users\tod\flightboard\
├── .env                       (unchanged)
├── .gitignore                 (unchanged)
├── CLAUDE.md                  (update with redesign notes)
├── package.json               (unchanged)
├── server.js                  (EXTENDED)
├── data/
│   ├── aircraftDatabase.csv   (unchanged)
│   ├── icao-iata-map.json     (unchanged)
│   └── notable-rules.json     (NEW)
└── public/
    ├── index.html             (REWRITTEN)
    ├── style.css              (REWRITTEN)
    ├── app.js                 (REWRITTEN)
    ├── fonts/
    │   ├── Inter-Regular.woff2
    │   ├── Inter-Medium.woff2
    │   ├── Inter-SemiBold.woff2
    │   └── JetBrainsMono-Medium.woff2
    └── assets/
        └── logos/             (populated at runtime)
            └── .gitkeep
```

---

## 14. Dashboard-manager registration

After the rebuild is complete, add this entry to `C:\Users\tod\dashboard-manager\projects.json`:

```json
{
  "id": "flightboard",
  "name": "FlightBoard",
  "description": "Live aircraft radar — Arvada CO",
  "icon": "✈️",
  "color": "#ffb347",
  "port": 3001,
  "repoUrl": "https://github.com/woohoo854-eng/flightboard",
  "localPath": "C:\\Users\\tod\\flightboard",
  "startCommand": "node server.js"
}
```

If `projects.json` is currently `[]`, replace with `[{ ... }]`. If other entries exist, comma-separate.

Restart the dashboard-manager:
```powershell
# In the dashboard-manager terminal: Ctrl+C, then
npm start
```

Verify: `http://192.168.1.3:3000` shows a FlightBoard tile. Tapping it loads `http://192.168.1.3:3000/app/flightboard` which proxies to flightboard on 3001.

---

## 15. Acceptance criteria

- From 8 feet away, callsign and altitude of the featured flight are legible
- Radar shows aircraft as oriented plane icons, not dots
- Compass needle sweeps smoothly when featured flight changes
- When a widebody or private jet is within 10 mi, the red ticker slides in
- Runs 12+ hours without memory leak or animation degradation
- If internet drops, last-known state persists 30s before "Skies clear"
- No flashing, no jarring transitions — calm and intentional
- Works identically at `http://192.168.1.3:3001` and `http://192.168.1.3:3000/app/flightboard`

---

## 16. Not in scope

Parked for a future pass:
- Weather overlay
- Historical stats / graphs
- Touch interactions (user specified fully passive)
- Audio alerts
- ADS-B hardware integration
- Multiple airport centers

---

## 17. Hand-off to Claude Code

Save this spec to `C:\Users\tod\flightboard\FLIGHTBOARD_REDESIGN_SPEC.md`, open Claude Code in that folder, and paste:

> Read `FLIGHTBOARD_REDESIGN_SPEC.md` in this folder. Build in the order specified in section 12. Stop after each numbered step, summarize what changed, and wait for me to confirm before moving on. The proxy-safe URL rules in section 0 are non-negotiable — every frontend URL must be relative. After step 15, stop and hand back so I can test on the kiosk.
