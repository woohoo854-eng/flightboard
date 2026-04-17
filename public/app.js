document.addEventListener('DOMContentLoaded', () => {
  console.log('[flightboard] startup');

  // Color constants — match CSS variables exactly
  const BG_PANEL_ALT   = '#161820';
  const ACCENT_AMBER   = '#ffb347';
  const ACCENT_CYAN    = '#5fd3e0';
  const TEXT_DIM       = '#555962';
  const TEXT_SECONDARY = '#8a8f98';

  // ── DOM refs: top bar ──────────────────────────────────────────────────────
  const clockEl = document.getElementById('clock');
  const countEl = document.getElementById('aircraft-count');

  // ── DOM refs: featured panel ───────────────────────────────────────────────
  const featFlight   = document.getElementById('feat-flight');
  const featEmpty    = document.getElementById('feat-empty');
  const featLogo     = document.getElementById('feat-logo');
  const featLogoFb   = document.getElementById('feat-logo-fallback');
  const featCallsign = document.getElementById('feat-callsign');
  const featRoute    = document.getElementById('feat-route');
  const featAlt      = document.getElementById('feat-alt');
  const featSpd      = document.getElementById('feat-spd');
  const featDist     = document.getElementById('feat-dist');
  const featType     = document.getElementById('feat-type');
  const featCaption  = document.getElementById('feat-caption');

  // ── DOM refs: ticker + dashboard ──────────────────────────────────────────
  const dashboardEl = document.getElementById('dashboard');
  const tickerEl    = document.getElementById('ticker');

  // ── DOM refs: stats panel ─────────────────────────────────────────────────
  const statCount      = document.getElementById('stat-count');
  const statHighest    = document.getElementById('stat-highest');
  const statHighestSub = document.getElementById('stat-highest-sub');
  const statClosest    = document.getElementById('stat-closest');
  const statClosestSub = document.getElementById('stat-closest-sub');
  const statBusiest    = document.getElementById('stat-busiest');
  const statAirline    = document.getElementById('stat-airline');
  const statAirlineSub = document.getElementById('stat-airline-sub');

  // ── DOM refs: compass ─────────────────────────────────────────────────────
  const compassNeedle   = document.getElementById('compass-needle');
  const compassTicks    = document.getElementById('compass-ticks');
  const compassValue    = document.getElementById('compass-value');
  const compassCardinal = document.getElementById('compass-cardinal');

  // ── DOM refs: radar ────────────────────────────────────────────────────────
  const radarPanel  = document.getElementById('radar-panel');
  const radarCanvas = document.getElementById('radar');
  const radarCtx    = radarCanvas.getContext('2d');
  const RADAR_PAD   = 32;

  // ── Radar: projection constants ────────────────────────────────────────────
  const ARVADA_LAT     = 39.8028;
  const ARVADA_LON     = -105.0875;
  const RANGE_MI       = 10;
  const MI_PER_DEG_LAT = 69.0;
  const MI_PER_DEG_LON = 69.0 * Math.cos(ARVADA_LAT * Math.PI / 180);

  function project(lat, lon, size) {
    const dxMi   = (lon - ARVADA_LON) * MI_PER_DEG_LON;
    const dyMi   = (lat - ARVADA_LAT) * MI_PER_DEG_LAT;
    const pxPerMi = (size / 2) / RANGE_MI;
    return {
      x: size / 2 + dxMi * pxPerMi,
      y: size / 2 - dyMi * pxPerMi,  // flip y: north is up
    };
  }

  // ── Radar: plane icon rasterization ───────────────────────────────────────
  // Path is 20×20 units, scaled 1.8× to ~36px; offscreen canvas is 56×56 so
  // rotation never clips the wingtips. Visual center of plane (x=10, y=9 in
  // path coords) is translated to canvas center so drawImage centering works.
  const PLANE_PATH  = 'M 10 1 L 11 9 L 18 12 L 18 13.5 L 11 12 L 11 15.5 L 13.5 17 L 13.5 18 L 10 17.5 L 6.5 18 L 6.5 17 L 9 15.5 L 9 12 L 2 13.5 L 2 12 L 9 9 Z';
  const PATH_SCALE  = 1.8;   // 20-unit path → ~36px
  const ICON_SIZE   = 56;    // offscreen canvas side length
  // Distance from canvas center to the tail's bottom edge in display pixels
  // tail at path-y=18 → canvas-y = (28 - 9*1.8) + 18*1.8 = 12 + 32.4 = 44.4, offset from center = 16.4
  const ICON_TAIL_OFFSET = 17;

  function createPlaneIcon(color, outlineColor) {
    const off = document.createElement('canvas');
    off.width = off.height = ICON_SIZE;
    const ctx = off.getContext('2d');
    // Place path visual center (10, 9) at canvas center (28, 28)
    ctx.translate(
      ICON_SIZE / 2 - 10 * PATH_SCALE,
      ICON_SIZE / 2 -  9 * PATH_SCALE
    );
    ctx.scale(PATH_SCALE, PATH_SCALE);
    const path = new Path2D(PLANE_PATH);
    ctx.fillStyle   = color;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth   = 1 / PATH_SCALE;  // 1px in canvas pixels
    ctx.fill(path);
    ctx.stroke(path);
    return off;
  }

  const iconCyan  = createPlaneIcon(ACCENT_CYAN,  BG_PANEL_ALT);
  const iconAmber = createPlaneIcon(ACCENT_AMBER, BG_PANEL_ALT);

  // ── Radar: live aircraft state (updated each poll) ─────────────────────────
  let radarAircraft   = [];
  let radarFeaturedId = null;

  // ── Radar: position trail history ──────────────────────────────────────────
  // Map<icao24, [{lat, lon, timestamp}]> — max 5 entries, oldest first
  const trailMap = new Map();

  // ── Radar: sweep animation state ───────────────────────────────────────────
  let sweepAngle     = 0;
  const SWEEP_PERIOD = 6000; // ms for full 360°

  // ── Compass: helpers + init ────────────────────────────────────────────────
  function headingToCardinal(deg) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                  'S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  function initCompass() {
    const NS  = 'http://www.w3.org/2000/svg';
    const cx = 200, cy = 200, outerR = 190;
    const majorAngles = { 0:'N', 90:'E', 180:'S', 270:'W' };
    const interAngles  = { 45:'NE', 135:'SE', 225:'SW', 315:'NW' };
    const skipAngles   = new Set([0, 45, 90, 135, 180, 225, 270, 315]);

    function pt(r, angle) {
      const rad = angle * Math.PI / 180;
      return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
    }
    function el(tag, attrs) {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    }

    // Minor ticks every 10° (skip cardinal positions)
    for (let a = 0; a < 360; a += 10) {
      if (skipAngles.has(a)) continue;
      const [x1, y1] = pt(outerR,     a);
      const [x2, y2] = pt(outerR - 4, a);
      compassTicks.appendChild(el('line', {
        x1: x1.toFixed(1), y1: y1.toFixed(1),
        x2: x2.toFixed(1), y2: y2.toFixed(1),
        stroke: 'var(--text-primary)', 'stroke-width': '1', opacity: '0.1',
      }));
    }

    // Major cardinal ticks + labels (N/E/S/W)
    for (const [angle, label] of Object.entries(majorAngles)) {
      const a = Number(angle);
      const [x1, y1] = pt(outerR,     a);
      const [x2, y2] = pt(outerR - 8, a);
      compassTicks.appendChild(el('line', {
        x1: x1.toFixed(1), y1: y1.toFixed(1),
        x2: x2.toFixed(1), y2: y2.toFixed(1),
        stroke: 'var(--text-primary)', 'stroke-width': '1.5',
      }));
      const [lx, ly] = pt(outerR - 30, a);
      const t = el('text', {
        x: lx.toFixed(1), y: ly.toFixed(1),
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '24', 'font-family': '"JetBrains Mono", monospace',
        'font-weight': '500', fill: 'var(--text-primary)',
      });
      t.textContent = label;
      compassTicks.appendChild(t);
    }

    // Intermediate cardinal labels (NE/SE/SW/NW)
    for (const [angle, label] of Object.entries(interAngles)) {
      const a = Number(angle);
      const [lx, ly] = pt(outerR - 30, a);
      const t = el('text', {
        x: lx.toFixed(1), y: ly.toFixed(1),
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': '16', 'font-family': '"JetBrains Mono", monospace',
        fill: 'var(--text-secondary)',
      });
      t.textContent = label;
      compassTicks.appendChild(t);
    }
  }

  initCompass();

  function updateCompass(heading) {
    if (heading == null) {
      compassNeedle.style.opacity   = '0';
      compassValue.textContent      = '—';
      compassCardinal.textContent   = '';
      return;
    }
    compassNeedle.style.opacity   = '1';
    compassNeedle.style.transform = `rotate(${heading}deg)`;
    compassValue.textContent      = `${Math.round(heading)}°`;
    compassCardinal.textContent   = headingToCardinal(heading);
  }

  // ── Clock: 1s tick ─────────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${h}:${m}:${s}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ── Featured panel ─────────────────────────────────────────────────────────
  let currentAircraft      = null;
  let currentLogoIcao      = null;
  let displayedFeaturedIcao = null;
  let crossfadeVersion      = 0;

  function updateFeaturedContent(ac) {
    currentAircraft = ac;
    updateCompass(ac.heading ?? null);

    // Logo
    if (ac.airlineIcao && ac.airlineIcao !== currentLogoIcao) {
      currentLogoIcao = ac.airlineIcao;
      featLogo.classList.add('hidden');
      featLogoFb.classList.add('hidden');
      featLogo.onload = () => {
        featLogo.classList.remove('hidden');
        featLogoFb.classList.add('hidden');
      };
      featLogo.onerror = () => {
        featLogo.classList.add('hidden');
        featLogoFb.textContent = ac.airlineIcao;
        featLogoFb.classList.remove('hidden');
      };
      featLogo.src = `api/logo/${ac.airlineIcao}`;
    } else if (!ac.airlineIcao && currentLogoIcao !== null) {
      currentLogoIcao = null;
      featLogo.classList.add('hidden');
      featLogoFb.textContent = ac.callsign ? ac.callsign.slice(0, 3) : '—';
      featLogoFb.classList.remove('hidden');
    }

    featCallsign.textContent = ac.callsign || ac.icao24.toUpperCase();
    featRoute.textContent    = '—';

    // ALT with vertical rate indicator
    const altText = ac.altitude != null
      ? new Intl.NumberFormat('en-US').format(Math.round(ac.altitude))
      : '—';
    const vr = ac.verticalRate;
    let vrHtml = '';
    if (vr != null && vr > 100)       vrHtml = '<span class="vrate-ind vrate-up">▲</span>';
    else if (vr != null && vr < -100) vrHtml = '<span class="vrate-ind vrate-down">▼</span>';
    featAlt.innerHTML = vrHtml + altText;

    featSpd.textContent  = ac.velocity   != null ? String(ac.velocity)       : '—';
    featDist.textContent = ac.distanceMi != null ? ac.distanceMi.toFixed(1)  : '—';

    if (ac.manufacturer && ac.model) {
      const combined = (ac.manufacturer + ' ' + ac.model).replace(/\s+/g, ' ').trim();
      featType.textContent = combined.length <= 24 ? combined : (ac.typecode || combined);
    } else if (ac.typecode) {
      featType.textContent = ac.typecode;
    } else {
      featType.textContent = '—';
    }

    updateCaption();
  }

  function renderFeatured(ac) {
    if (!ac) {
      featFlight.classList.add('hidden');
      featEmpty.classList.remove('hidden');
      displayedFeaturedIcao = null;
      currentAircraft = null;
      updateCompass(null);
      return;
    }

    featEmpty.classList.add('hidden');

    if (ac.icao24 === displayedFeaturedIcao) {
      // Same aircraft — update values in place, no animation
      updateFeaturedContent(ac);
      return;
    }

    const version = ++crossfadeVersion;
    displayedFeaturedIcao = ac.icao24;

    const wasHidden = featFlight.classList.contains('hidden');
    if (wasHidden) {
      // Coming from empty state — populate then slide in
      updateFeaturedContent(ac);
      featFlight.style.transition = 'none';
      featFlight.style.opacity    = '0';
      featFlight.style.transform  = 'translateY(20px)';
      featFlight.classList.remove('hidden');
      featFlight.getBoundingClientRect(); // force reflow
      featFlight.style.transition = '';
      featFlight.style.opacity    = '1';
      featFlight.style.transform  = 'translateY(0)';
      return;
    }

    // Different aircraft — fade out, then swap content, then slide in
    featFlight.style.opacity   = '0';
    featFlight.style.transform = 'translateY(0)';

    setTimeout(() => {
      if (crossfadeVersion !== version) return; // superseded by a newer call
      updateFeaturedContent(ac);
      featFlight.style.transition = 'none';
      featFlight.style.opacity    = '0';
      featFlight.style.transform  = 'translateY(20px)';
      featFlight.getBoundingClientRect();
      featFlight.style.transition = '';
      featFlight.style.opacity    = '1';
      featFlight.style.transform  = 'translateY(0)';
    }, 500); // 400ms fade-out + 100ms hold
  }

  function updateCaption() {
    if (!currentAircraft) return;
    const ac  = currentAircraft;
    const id  = ac.registration || ac.callsign || ac.icao24.toUpperCase();
    if (ac.lastSeen) {
      const ago = Math.round(Date.now() / 1000 - ac.lastSeen);
      featCaption.textContent = `Last seen ${ago}s ago · ${id}`;
    } else {
      featCaption.textContent = id;
    }
  }
  setInterval(updateCaption, 1000);

  // ── Radar: canvas setup ────────────────────────────────────────────────────
  let radarLogicalSize = 0;

  function setupRadarCanvas() {
    const rect  = radarPanel.getBoundingClientRect();
    const innerW = rect.width  - RADAR_PAD * 2;
    const innerH = rect.height - RADAR_PAD * 2;
    const size   = Math.floor(Math.min(innerW, innerH));
    if (size <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    radarLogicalSize        = size;
    radarCanvas.style.width  = size + 'px';
    radarCanvas.style.height = size + 'px';
    radarCanvas.width  = Math.round(size * dpr);
    radarCanvas.height = Math.round(size * dpr);
    drawRadar();
  }

  new ResizeObserver(setupRadarCanvas).observe(radarPanel);

  // ── Radar: draw ────────────────────────────────────────────────────────────
  function drawRadar() {
    if (radarLogicalSize <= 0) return;
    const dpr    = window.devicePixelRatio || 1;
    const ctx    = radarCtx;
    const s      = radarLogicalSize;
    const cx     = s / 2;
    const cy     = s / 2;
    const outerR = s / 2;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, s, s);

    // 1. Backdrop
    ctx.fillStyle = BG_PANEL_ALT;
    ctx.fillRect(0, 0, s, s);

    // 2. Range rings — 2.5 / 5 / 10 mi, dashed
    const rings = [
      { r: outerR * 0.25, label: '2.5 MI' },
      { r: outerR * 0.5,  label: '5 MI'   },
      { r: outerR,        label: '10 MI'  },
    ];
    ctx.strokeStyle = 'rgba(95, 211, 224, 0.15)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 6]);
    for (const ring of rings) {
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Ring distance labels — 11px mono, just above each ring at 12 o'clock
    ctx.font         = '11px "JetBrains Mono", monospace';
    ctx.fillStyle    = TEXT_DIM;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    for (const ring of rings) {
      ctx.fillText(ring.label, cx, cy - ring.r - 3);
    }

    // 3. Cardinal grid lines — N-S and E-W through center
    ctx.strokeStyle = 'rgba(95, 211, 224, 0.08)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(s, cy); ctx.stroke();

    // 4. Cardinal labels — 14px Inter medium, ~20px inside outer ring
    ctx.font         = '500 14px "Inter", system-ui, sans-serif';
    ctx.fillStyle    = TEXT_SECONDARY;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const lR = outerR - 20;
    ctx.fillText('N', cx,      cy - lR);
    ctx.fillText('S', cx,      cy + lR);
    ctx.fillText('E', cx + lR, cy     );
    ctx.fillText('W', cx - lR, cy     );

    // 4.5. Sweep wedge — 12° conic, rgba(95,211,224,0.04), rotates 360° per SWEEP_PERIOD
    {
      const sweepEndRad   = (sweepAngle - 90) * Math.PI / 180;
      const sweepStartRad = sweepEndRad - 12 * Math.PI / 180;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, sweepStartRad, sweepEndRad, false);
      ctx.closePath();
      ctx.fillStyle = 'rgba(95,211,224,0.04)';
      ctx.fill();
      ctx.restore();
    }

    // 5. Trails — fading polylines behind each aircraft
    for (const ac of radarAircraft) {
      const trail = trailMap.get(ac.icao24);
      if (!trail || trail.length < 2) continue;
      const isFeat  = ac.icao24 === radarFeaturedId;
      const color   = isFeat ? 'rgba(255,179,71,0.8)' : 'rgba(95,211,224,0.8)';
      ctx.lineWidth = 1.5;
      ctx.lineCap   = 'round';
      for (let i = 1; i < trail.length; i++) {
        const prev    = project(trail[i - 1].lat, trail[i - 1].lon, s);
        const curr    = project(trail[i].lat,     trail[i].lon,     s);
        const progress      = i / (trail.length - 1);  // 0→1 oldest→newest
        ctx.globalAlpha     = 0.05 + (0.4 - 0.05) * progress;
        ctx.strokeStyle     = color;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Aircraft icons: non-featured first, featured on top
    const others   = radarAircraft.filter(a => a.icao24 !== radarFeaturedId);
    const featured = radarAircraft.find(a => a.icao24 === radarFeaturedId) || null;

    for (const ac of others)          drawAircraftIcon(ctx, ac, false, s);
    if (featured)                      drawAircraftIcon(ctx, featured, true, s);

    // 7. Arvada marker — drawn last, always on top
    const triSide = 14;
    const triH    = triSide * Math.sqrt(3) / 2;
    ctx.fillStyle = ACCENT_AMBER;
    ctx.beginPath();
    ctx.moveTo(cx,               cy - (triH * 2 / 3));
    ctx.lineTo(cx + triSide / 2, cy + triH / 3);
    ctx.lineTo(cx - triSide / 2, cy + triH / 3);
    ctx.closePath();
    ctx.fill();

    ctx.font          = '11px "JetBrains Mono", monospace';
    ctx.fillStyle     = ACCENT_AMBER;
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'top';
    ctx.letterSpacing = '0.2em';
    ctx.fillText('ARVADA', cx, cy + triH / 3 + 5);
    ctx.letterSpacing = '0px';

    // No-flights overlay
    if (radarAircraft.length === 0) {
      ctx.font         = '500 24px "Inter", system-ui, sans-serif';
      ctx.fillStyle    = TEXT_SECONDARY;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Skies clear over Arvada', cx, cy + 40);
    }

    ctx.restore();
  }

  function drawAircraftIcon(ctx, ac, isFeatured, s) {
    if (ac.distanceMi > RANGE_MI) return;
    if (ac.lat == null || ac.lon == null) return;

    const pos     = project(ac.lat, ac.lon, s);
    const scale   = isFeatured ? 1.4 : 1.0;
    const icon    = isFeatured ? iconAmber : iconCyan;
    const heading = ac.heading != null ? ac.heading : 0;
    const headRad = heading * Math.PI / 180;

    // Draw rotated icon
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(headRad);
    ctx.scale(scale, scale);
    ctx.drawImage(icon, -ICON_SIZE / 2, -ICON_SIZE / 2);
    ctx.restore();

    // Callsign label: 8px below the tail edge after display scaling
    const labelY      = pos.y + ICON_TAIL_OFFSET * scale + 8;
    const label       = ac.callsign || ac.icao24.toUpperCase();
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'top';
    if (isFeatured) {
      ctx.font      = '500 14px "JetBrains Mono", monospace';
      ctx.fillStyle = ACCENT_AMBER;
    } else {
      ctx.font      = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = TEXT_DIM;
    }
    ctx.fillText(label, pos.x, labelY);
  }

  // ── Ticker ────────────────────────────────────────────────────────────────
  let currentNotableIcao = null;
  let tickerDismissTimer = null;
  const DISMISS_DELAY    = 30000;

  function findNotable(aircraft, featuredIcao) {
    if (!aircraft || aircraft.length === 0) return null;
    const featured = aircraft.find(a => a.icao24 === featuredIcao);
    if (featured && featured.notable) return featured;
    return aircraft.find(a => a.notable) || null;
  }

  function formatTickerContent(ac) {
    const id     = ac.registration || ac.callsign || ac.icao24.toUpperCase();
    const type   = ac.model || ac.typecode || '—';
    const reason = ac.notableReason || '—';
    const alt    = ac.altitude != null
      ? new Intl.NumberFormat('en-US').format(Math.round(ac.altitude)) + ' ft' : '—';
    const dist   = ac.distanceMi != null ? ac.distanceMi.toFixed(1) + ' mi' : '—';
    const dir    = ac.bearing   != null ? headingToCardinal(ac.bearing) : '';
    return `<span class="ticker-flag">⚑</span>${id} · ${type} · ${reason} · ${alt} · ${dist} ${dir}`.trimEnd();
  }

  function setTickerContent(ac) {
    tickerEl.innerHTML = formatTickerContent(ac);
  }

  function animateTickerIn() {
    tickerEl.style.transition = 'none';
    tickerEl.style.opacity    = '0';
    tickerEl.style.transform  = 'translateY(20px)';
    tickerEl.getBoundingClientRect(); // force reflow
    tickerEl.style.transition = 'opacity 200ms ease, transform 200ms ease';
    tickerEl.style.opacity    = '1';
    tickerEl.style.transform  = 'translateY(0)';
  }

  function showTicker(ac) {
    currentNotableIcao = ac.icao24;
    setTickerContent(ac);
    dashboardEl.classList.add('ticker-active');
    setTimeout(animateTickerIn, 80); // let grid row start expanding first
  }

  function crossfadeTicker(ac) {
    tickerEl.style.transition = 'opacity 200ms ease, transform 200ms ease';
    tickerEl.style.opacity    = '0';
    tickerEl.style.transform  = 'translateY(-10px)';
    setTimeout(() => {
      currentNotableIcao        = ac.icao24;
      setTickerContent(ac);
      tickerEl.style.transition = 'none';
      tickerEl.style.transform  = 'translateY(20px)';
      tickerEl.getBoundingClientRect();
      tickerEl.style.transition = 'opacity 200ms ease, transform 200ms ease';
      tickerEl.style.opacity    = '1';
      tickerEl.style.transform  = 'translateY(0)';
    }, 200);
  }

  function hideTicker() {
    tickerEl.style.transition = 'opacity 200ms ease';
    tickerEl.style.opacity    = '0';
    setTimeout(() => {
      dashboardEl.classList.remove('ticker-active');
      currentNotableIcao   = null;
      tickerEl.innerHTML   = '';
      tickerEl.style.cssText = '';
    }, 200);
  }

  function updateTicker(aircraft, featuredIcao) {
    const notable  = findNotable(aircraft, featuredIcao);
    const isActive = dashboardEl.classList.contains('ticker-active');

    if (!notable) {
      // Notable left range — start dismiss timer if not already counting down
      if (isActive && !tickerDismissTimer) {
        tickerDismissTimer = setTimeout(() => {
          tickerDismissTimer = null;
          hideTicker();
        }, DISMISS_DELAY);
      }
      return;
    }

    // Notable present — cancel any pending dismiss
    if (tickerDismissTimer) {
      clearTimeout(tickerDismissTimer);
      tickerDismissTimer = null;
    }

    if (!isActive) {
      showTicker(notable);
    } else if (notable.icao24 !== currentNotableIcao) {
      crossfadeTicker(notable);
    } else {
      setTickerContent(notable); // same aircraft, refresh values
    }
  }

  // ── Stats fetch ────────────────────────────────────────────────────────────
  function fetchStats() {
    fetch('api/stats')
      .then(res => res.json())
      .then(d => {
        statCount.textContent      = d.uniqueAircraftCount > 0 ? d.uniqueAircraftCount : '—';

        statHighest.textContent    = d.highestAltitude.feet !== '—'
          ? `${d.highestAltitude.feet} ft` : '—';
        statHighestSub.textContent = d.highestAltitude.callsign !== '—'
          ? d.highestAltitude.callsign : '';

        statClosest.textContent    = d.closestApproach.miles !== '—'
          ? `${d.closestApproach.miles} mi` : '—';
        statClosestSub.textContent = d.closestApproach.callsign !== '—'
          ? d.closestApproach.callsign : '';

        statBusiest.textContent    = d.busiestHour.count > 0
          ? `${d.busiestHour.hour} (${d.busiestHour.count})` : '—';

        statAirline.textContent    = d.topAirline.icao !== '—' ? d.topAirline.icao : '—';
        statAirlineSub.textContent = d.topAirline.name !== '—' ? d.topAirline.name : '';
      })
      .catch(err => console.error('[flightboard] stats fetch error:', err));
  }

  // ── Radar: continuous rAF loop ────────────────────────────────────────────
  let lastFrameTime = null;
  (function radarLoop(timestamp) {
    if (lastFrameTime !== null) {
      const dt = timestamp - lastFrameTime;
      sweepAngle = (sweepAngle + 360 * dt / SWEEP_PERIOD) % 360;
    }
    lastFrameTime = timestamp;
    drawRadar();
    requestAnimationFrame(radarLoop);
  }(performance.now()));

  // ── API polling: 5s ────────────────────────────────────────────────────────
  let lastSuccessTime = Date.now();

  function poll() {
    fetch('api/aircraft')
      .then(res => res.json())
      .then(data => {
        lastSuccessTime = Date.now();
        console.log(`[${new Date().toISOString()}]`, data);

        const n = data.count ?? (data.aircraft ? data.aircraft.length : 0);
        countEl.textContent = `${n} aircraft in range`;

        radarAircraft   = data.aircraft || [];
        radarFeaturedId = data.featured || null;

        // Update trail history
        const seen = new Set();
        for (const ac of radarAircraft) {
          if (ac.lat == null || ac.lon == null) continue;
          seen.add(ac.icao24);
          const trail = trailMap.get(ac.icao24) || [];
          trail.push({ lat: ac.lat, lon: ac.lon, timestamp: Date.now() });
          if (trail.length > 5) trail.shift();
          trailMap.set(ac.icao24, trail);
        }
        // Evict aircraft that left range
        for (const id of trailMap.keys()) {
          if (!seen.has(id)) trailMap.delete(id);
        }

        const featuredAc = data.featured
          ? data.aircraft.find(a => a.icao24 === data.featured)
          : (data.aircraft && data.aircraft.length > 0 ? data.aircraft[0] : null);
        renderFeatured(featuredAc || null);
        updateTicker(data.aircraft || [], data.featured || null);

        fetchStats();
      })
      .catch(err => {
        console.error('[flightboard] fetch error:', err);
        // After 30s of no successful response, clear to no-flights state
        if (Date.now() - lastSuccessTime > 30000) {
          radarAircraft   = [];
          radarFeaturedId = null;
          renderFeatured(null);
          updateTicker([], null);
        }
      });
  }

  poll();
  setInterval(poll, 5000);
});
