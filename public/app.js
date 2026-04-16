// FlightBoard frontend

const typeNames = {
  A19N: 'Airbus A319neo', A20N: 'Airbus A320neo', A21N: 'Airbus A321neo',
  A225: 'Antonov An-225', A306: 'Airbus A300-600', A30B: 'Airbus A300',
  A310: 'Airbus A310', A318: 'Airbus A318', A319: 'Airbus A319',
  A320: 'Airbus A320', A321: 'Airbus A321', A332: 'Airbus A330-200',
  A333: 'Airbus A330-300', A338: 'Airbus A330-800neo', A339: 'Airbus A330-900neo',
  A342: 'Airbus A340-200', A343: 'Airbus A340-300', A345: 'Airbus A340-500',
  A346: 'Airbus A340-600', A359: 'Airbus A350-900', A35K: 'Airbus A350-1000',
  A388: 'Airbus A380', B37M: 'Boeing 737 MAX 7', B38M: 'Boeing 737 MAX 8',
  B39M: 'Boeing 737 MAX 9', B3XM: 'Boeing 737 MAX 10',
  B712: 'Boeing 717', B721: 'Boeing 727-100', B722: 'Boeing 727-200',
  B731: 'Boeing 737-100', B732: 'Boeing 737-200', B733: 'Boeing 737-300',
  B734: 'Boeing 737-400', B735: 'Boeing 737-500', B736: 'Boeing 737-600',
  B737: 'Boeing 737-700', B738: 'Boeing 737-800', B739: 'Boeing 737-900',
  B741: 'Boeing 747-100', B742: 'Boeing 747-200', B743: 'Boeing 747-300',
  B744: 'Boeing 747-400', B748: 'Boeing 747-8', B74S: 'Boeing 747SP',
  B752: 'Boeing 757-200', B753: 'Boeing 757-300',
  B762: 'Boeing 767-200', B763: 'Boeing 767-300', B764: 'Boeing 767-400',
  B772: 'Boeing 777-200', B77L: 'Boeing 777-200LR', B77W: 'Boeing 777-300ER',
  B778: 'Boeing 777-8', B779: 'Boeing 777-9',
  B788: 'Boeing 787-8', B789: 'Boeing 787-9', B78X: 'Boeing 787-10',
  BCS1: 'Airbus A220-100', BCS3: 'Airbus A220-300',
  C130: 'Lockheed C-130', C17: 'Boeing C-17',
  C172: 'Cessna 172', C182: 'Cessna 182', C206: 'Cessna 206', C208: 'Cessna 208 Caravan',
  C25A: 'Cessna CJ2', C25B: 'Cessna CJ3', C25C: 'Cessna CJ4',
  C510: 'Cessna Mustang', C525: 'Cessna CitationJet', C550: 'Cessna Citation II',
  C560: 'Cessna Citation V', C56X: 'Cessna Citation Excel', C680: 'Cessna Sovereign',
  C68A: 'Cessna Latitude', C700: 'Cessna Longitude', C72R: 'Cessna 172RG',
  CL30: 'Bombardier Challenger 300', CL35: 'Bombardier Challenger 350',
  CL60: 'Bombardier Challenger 600', CRJ2: 'Bombardier CRJ-200',
  CRJ7: 'Bombardier CRJ-700', CRJ9: 'Bombardier CRJ-900',
  CRJX: 'Bombardier CRJ-1000',
  DA40: 'Diamond DA40', DA42: 'Diamond DA42', DA62: 'Diamond DA62',
  DC10: 'McDonnell Douglas DC-10', DHC6: 'Viking Twin Otter',
  DH8A: 'Dash 8-100', DH8B: 'Dash 8-200', DH8C: 'Dash 8-300', DH8D: 'Dash 8-400',
  E135: 'Embraer ERJ-135', E145: 'Embraer ERJ-145',
  E170: 'Embraer E170', E175: 'Embraer E175',
  E190: 'Embraer E190', E195: 'Embraer E195',
  E75L: 'Embraer E175', E75S: 'Embraer E175',
  E290: 'Embraer E190-E2', E295: 'Embraer E195-E2',
  F2TH: 'Dassault Falcon 2000', F900: 'Dassault Falcon 900',
  FA7X: 'Dassault Falcon 7X', FA8X: 'Dassault Falcon 8X',
  G280: 'Gulfstream G280', G550: 'Gulfstream G550',
  G650: 'Gulfstream G650', GL5T: 'Bombardier Global 5000',
  GL7T: 'Bombardier Global 7500', GLEX: 'Bombardier Global Express',
  GLF4: 'Gulfstream G-IV', GLF5: 'Gulfstream G-V', GLF6: 'Gulfstream G650',
  H25B: 'Hawker 800', H25C: 'Hawker 1000',
  LJ35: 'Learjet 35', LJ45: 'Learjet 45', LJ60: 'Learjet 60', LJ75: 'Learjet 75',
  MD11: 'McDonnell Douglas MD-11', MD82: 'McDonnell Douglas MD-82',
  MD83: 'McDonnell Douglas MD-83', MD88: 'McDonnell Douglas MD-88',
  P28A: 'Piper Cherokee', PA18: 'Piper Super Cub', PA28: 'Piper Cherokee',
  PA32: 'Piper Saratoga', PA34: 'Piper Seneca', PA44: 'Piper Seminole',
  PA46: 'Piper Malibu', PC12: 'Pilatus PC-12', PC24: 'Pilatus PC-24',
  RV7: 'Van\'s RV-7', RV8: 'Van\'s RV-8', RV10: 'Van\'s RV-10',
  SF50: 'Cirrus Vision Jet', SR20: 'Cirrus SR20', SR22: 'Cirrus SR22',
  SU95: 'Sukhoi Superjet 100', SW4: 'Swearingen Metroliner',
  TBM7: 'Daher TBM 700', TBM8: 'Daher TBM 850', TBM9: 'Daher TBM 900',
  '737-8': 'Boeing 737-800', BE35: 'Beechcraft Bonanza', BE36: 'Beechcraft Bonanza',
  BE40: 'Beechcraft Beechjet', BE55: 'Beechcraft Baron', BE58: 'Beechcraft Baron',
  BE9L: 'Beechcraft King Air 90', BE20: 'Beechcraft King Air 200',
  B350: 'Beechcraft King Air 350',
};

// --- 16-point compass direction ---
const COMPASS_POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function compassDirection(deg) {
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return COMPASS_POINTS[idx];
}

// --- Haversine distance (miles) and bearing from home ---
const HOME_LAT = 39.8028;
const HOME_LON = -105.0875;

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function bearingFrom(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const r1 = lat1 * Math.PI / 180;
  const r2 = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(r2);
  const x = Math.cos(r1) * Math.sin(r2) - Math.sin(r1) * Math.cos(r2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// --- Route lookup cache (adsbdb) ---
// Values: null = lookup in progress, { origin, destination } = found, false = no route
const routeCache = {};
let routeCacheHits = 0;
let routeCacheMisses = 0;

function lookupRoute(callsign) {
  if (callsign in routeCache) {
    routeCacheHits++;
    console.log(`[route] cache hit: ${callsign} (hits=${routeCacheHits} misses=${routeCacheMisses})`);
    return;
  }
  routeCacheMisses++;
  console.log(`[route] cache miss, fetching: ${callsign} (hits=${routeCacheHits} misses=${routeCacheMisses})`);
  routeCache[callsign] = null; // mark in-progress
  fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`)
    .then(res => res.json())
    .then(data => {
      const fr = data && data.response && data.response.flightroute;
      if (fr && fr.origin && fr.destination) {
        routeCache[callsign] = {
          origin: fr.origin.iata_code || fr.origin.icao_code || '',
          originCity: fr.origin.municipality || '',
          destination: fr.destination.iata_code || fr.destination.icao_code || '',
          destinationCity: fr.destination.municipality || ''
        };
        console.log(`[route] found: ${callsign} → ${routeCache[callsign].origin} → ${routeCache[callsign].destination}`);
      } else {
        routeCache[callsign] = false;
        console.log(`[route] no route: ${callsign}`);
      }
      // Refresh display if this callsign is still showing
      if (flights.length > 0 && flights[currentIndex] && flights[currentIndex].callsign === callsign) {
        updateRouteDisplay(callsign);
      }
    })
    .catch(err => {
      routeCache[callsign] = false;
      console.log(`[route] error for ${callsign}: ${err.message}`);
    });
}

function updateRouteDisplay(callsign) {
  const route = routeCache[callsign];
  if (route && route.origin && route.destination) {
    els.route.textContent = `${route.origin} → ${route.destination}`;
  } else {
    els.route.textContent = '';
  }
}

// --- Viewport scaling: fit 1920x440 into any browser window ---
function scaleDisplay() {
  const display = document.getElementById('display');
  const scaleX = window.innerWidth / 1920;
  const scaleY = window.innerHeight / 440;
  const scale = Math.min(scaleX, scaleY);
  display.style.transform = `scale(${scale})`;
  display.style.left = ((window.innerWidth - 1920 * scale) / 2) + 'px';
  display.style.top = ((window.innerHeight - 440 * scale) / 2) + 'px';
}
scaleDisplay();
window.addEventListener('resize', scaleDisplay);

let flights = [];
let currentIndex = 0;
let countdownSeconds = 12;
let currentHeading = null;
let animatingHeading = null;
let animationFrame = null;

// DOM refs
const els = {
  clock: document.getElementById('clock'),
  liveDot: document.getElementById('live-dot'),
  statusText: document.getElementById('status-text'),
  callsign: document.getElementById('callsign'),
  aircraftType: document.getElementById('aircraft-type'),
  vrateBadge: document.getElementById('vrate-badge'),
  altitude: document.getElementById('altitude'),
  route: document.getElementById('route'),
  speed: document.getElementById('speed'),
  distance: document.getElementById('distance'),
  lastSeen: document.getElementById('last-seen'),
  airlineLogo: document.getElementById('airline-logo'),
  airlineCode: document.getElementById('airline-code'),
  compass: document.getElementById('compass'),
  headingReadout: document.getElementById('heading-readout'),
  aircraftCount: document.getElementById('aircraft-count'),
  pagerDots: document.getElementById('pager-dots'),
  countdown: document.getElementById('countdown'),
  card: document.getElementById('card'),
  noFlights: document.getElementById('no-flights'),
  radar: document.getElementById('radar')
};

// --- Radar sweep ---
const RADAR_W = 1920;
const RADAR_H = 356;
const RADAR_CX = 1400;  // origin: center-right area
const RADAR_CY = RADAR_H / 2;
const RADAR_R = 400;    // sweep radius
const ARVADA_LAT = 39.8028;
const ARVADA_LON = -105.0875;
const BBOX_LAT_HALF = (40.014 - 39.591) / 2;  // 0.2115 degrees
const BBOX_LON_HALF = (-104.826 - (-105.326)) / 2;  // 0.25 degrees

let radarAngle = 0;
let aircraftDotX = null;
let aircraftDotY = null;
let dotPulseAlpha = 0;

// Set canvas backing size
els.radar.width = RADAR_W;
els.radar.height = RADAR_H;

function calcAircraftDot(lat, lon) {
  if (lat == null || lon == null) {
    aircraftDotX = null;
    aircraftDotY = null;
    return;
  }
  // Offset from Arvada center, normalized to bounding box half-span
  const dx = (lon - ARVADA_LON) / BBOX_LON_HALF;
  const dy = -(lat - ARVADA_LAT) / BBOX_LAT_HALF;  // negative: north is up
  // Map to radar canvas centered on RADAR_CX, RADAR_CY
  aircraftDotX = RADAR_CX + dx * RADAR_R * 0.8;
  aircraftDotY = RADAR_CY + dy * RADAR_R * 0.8;
}

function drawRadar() {
  const ctx = els.radar.getContext('2d');
  ctx.clearRect(0, 0, RADAR_W, RADAR_H);

  // Subtle range rings
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#4466aa';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(RADAR_CX, RADAR_CY, (RADAR_R / 3) * i, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Sweep line
  const rad = radarAngle * Math.PI / 180;
  const sweepX = RADAR_CX + Math.cos(rad) * RADAR_R;
  const sweepY = RADAR_CY + Math.sin(rad) * RADAR_R;

  // Sweep trail gradient (wedge-shaped fade)
  ctx.globalAlpha = 1;
  const trailAngle = 30; // degrees of trail
  for (let i = 0; i < trailAngle; i++) {
    const a = (radarAngle - i) * Math.PI / 180;
    const alpha = 0.12 * (1 - i / trailAngle);
    ctx.beginPath();
    ctx.moveTo(RADAR_CX, RADAR_CY);
    ctx.lineTo(RADAR_CX + Math.cos(a) * RADAR_R, RADAR_CY + Math.sin(a) * RADAR_R);
    ctx.strokeStyle = `rgba(0, 255, 204, ${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Main sweep line
  ctx.beginPath();
  ctx.moveTo(RADAR_CX, RADAR_CY);
  ctx.lineTo(sweepX, sweepY);
  ctx.strokeStyle = 'rgba(0, 255, 204, 0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center dot
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.arc(RADAR_CX, RADAR_CY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#4488ff';
  ctx.fill();

  // Aircraft dot
  if (aircraftDotX != null && aircraftDotY != null) {
    // Check if sweep is near the dot
    const dotAngle = Math.atan2(aircraftDotY - RADAR_CY, aircraftDotX - RADAR_CX) * 180 / Math.PI;
    let angleDiff = ((radarAngle - dotAngle) % 360 + 360) % 360;
    if (angleDiff > 180) angleDiff = 360 - angleDiff;

    if (angleDiff < 8) {
      dotPulseAlpha = 1.0;
    }

    // Breathing scale: oscillates 1.0 to 1.4 over 2 seconds
    const breathe = 1.0 + 0.2 * (1 + Math.sin(performance.now() / 1000 * Math.PI));

    // Outer glow
    const baseAlpha = 0.5;
    const drawAlpha = Math.max(baseAlpha, dotPulseAlpha);
    ctx.globalAlpha = drawAlpha * 0.3;
    ctx.beginPath();
    ctx.arc(aircraftDotX, aircraftDotY, 12 * breathe, 0, Math.PI * 2);
    ctx.fillStyle = '#60a0ff';
    ctx.fill();

    // Main dot (12px diameter = radius 6)
    ctx.globalAlpha = drawAlpha;
    ctx.beginPath();
    ctx.arc(aircraftDotX, aircraftDotY, 6 * breathe, 0, Math.PI * 2);
    ctx.fillStyle = '#60a0ff';
    ctx.fill();

    // White inner core (4px diameter = radius 2)
    ctx.globalAlpha = drawAlpha * 0.9;
    ctx.beginPath();
    ctx.arc(aircraftDotX, aircraftDotY, 2 * breathe, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Sweep pulse ring
    if (dotPulseAlpha > baseAlpha + 0.1) {
      ctx.globalAlpha = (dotPulseAlpha - baseAlpha) * 0.6;
      ctx.beginPath();
      ctx.arc(aircraftDotX, aircraftDotY, 16 + (1.0 - dotPulseAlpha) * 28, 0, Math.PI * 2);
      ctx.strokeStyle = '#60a0ff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Decay pulse
    dotPulseAlpha *= 0.95;
    if (dotPulseAlpha < baseAlpha) dotPulseAlpha = 0;
  }

  ctx.globalAlpha = 1;

  // Advance sweep
  radarAngle = (radarAngle + 1.8) % 360;
  requestAnimationFrame(drawRadar);
}

drawRadar();

// --- Entry animation ---
function animateEntry() {
  const items = [
    els.callsign,
    els.aircraftType,
    els.route,
    els.altitude,
    els.vrateBadge,
    els.speed,
    els.distance,
    els.lastSeen
  ];

  // Reset all to hidden
  items.forEach(el => {
    el.classList.add('anim-entry');
    el.classList.remove('visible');
  });

  // Stagger reveal
  items.forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('visible');
    }, i * 150);
  });
}

// --- Clock ---
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  els.clock.textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

// --- Fetch flights ---
let lastFetchTime = 0;

async function fetchFlights() {
  try {
    const res = await fetch('/api/flights');
    const data = await res.json();
    flights = data.states || [];
    lastFetchTime = Date.now();

    els.liveDot.classList.remove('stale');
    els.statusText.textContent = 'LIVE';

    // If current index is beyond range, reset
    if (currentIndex >= flights.length) {
      currentIndex = 0;
    }

    updateDisplay();
  } catch (err) {
    console.error('Fetch error:', err);
    els.liveDot.classList.add('stale');
    els.statusText.textContent = 'OFFLINE';
  }
}

// Poll every 30 seconds, matching backend
setInterval(fetchFlights, 30000);
fetchFlights().then(() => { if (flights.length > 0) animateEntry(); });

// --- Stale check ---
setInterval(() => {
  if (Date.now() - lastFetchTime > 60000) {
    els.liveDot.classList.add('stale');
    els.statusText.textContent = 'STALE';
  }
}, 5000);

// --- Display ---
function updateDisplay() {
  if (flights.length === 0) {
    els.card.style.visibility = 'hidden';
    els.noFlights.classList.remove('hidden');
    aircraftDotX = null;
    aircraftDotY = null;
    els.aircraftCount.textContent = '0 aircraft';
    els.pagerDots.innerHTML = '';
    els.countdown.textContent = '';
    els.headingReadout.textContent = '';
    return;
  }

  els.card.style.visibility = 'visible';
  els.noFlights.classList.add('hidden');

  const f = flights[currentIndex];

  // Update radar aircraft dot
  calcAircraftDot(f.latitude, f.longitude);

  // Callsign
  els.callsign.textContent = f.callsign || f.icao24.toUpperCase();

  // Aircraft type
  const rawType = f.aircraftType || '';
  els.aircraftType.textContent = typeNames[rawType] || rawType;

  // Route lookup (non-blocking)
  if (f.callsign) {
    lookupRoute(f.callsign);
    updateRouteDisplay(f.callsign);
  } else {
    els.route.textContent = '';
  }

  // Vertical rate badge
  const vr = f.verticalRate;
  if (vr === null || vr === undefined || Math.abs(vr) < 0.5) {
    els.vrateBadge.textContent = 'LEVEL';
    els.vrateBadge.className = 'level';
  } else if (vr > 0) {
    els.vrateBadge.textContent = `\u2191 ${Math.round(vr * 196.85)} ft/min`;
    els.vrateBadge.className = 'climbing';
  } else {
    els.vrateBadge.textContent = `\u2193 ${Math.abs(Math.round(vr * 196.85))} ft/min`;
    els.vrateBadge.className = 'descending';
  }

  // Altitude (meters to feet)
  const altM = f.geoAltitude !== null ? f.geoAltitude : f.baroAltitude;
  if (altM !== null && altM !== undefined) {
    const altFt = Math.round(altM * 3.28084);
    els.altitude.textContent = altFt.toLocaleString() + ' ft';
  } else {
    els.altitude.textContent = '--- ft';
  }

  // Speed (m/s to knots and mph)
  if (f.velocity !== null && f.velocity !== undefined) {
    const knots = Math.round(f.velocity * 1.94384);
    const mph = Math.round(knots * 1.15078);
    els.speed.textContent = knots + ' kts / ' + mph + ' mph';
  } else {
    els.speed.textContent = '--- kts / --- mph';
  }

  // Distance and direction from home
  if (f.latitude != null && f.longitude != null) {
    const dist = haversineDistance(HOME_LAT, HOME_LON, f.latitude, f.longitude);
    const bearing = bearingFrom(HOME_LAT, HOME_LON, f.latitude, f.longitude);
    els.distance.textContent = dist.toFixed(1) + ' mi ' + compassDirection(bearing);
  } else {
    els.distance.textContent = '';
  }

  // Last seen
  if (f.lastSeen) {
    const ago = Math.round(Date.now() / 1000 - f.lastSeen);
    els.lastSeen.textContent = ago > 0 ? `seen ${ago}s ago` : 'just now';
  } else {
    els.lastSeen.textContent = '';
  }

  // Airline logo
  const fallbackCode = (f.icaoPrefix && f.callsign && /^[A-Z]{3}/.test(f.callsign)) ? f.icaoPrefix : 'GA';

  if (f.iataCode) {
    const logoUrl = `https://www.gstatic.com/flights/airline_logos/70px/${f.iataCode}.png`;
    // Only reassign src if URL changed — avoids re-triggering load/redirect cycle
    if (els.airlineLogo.src !== logoUrl) {
      els.airlineLogo.onerror = null;
      els.airlineLogo.onload = null;
      const expectedCallsign = f.callsign;
      els.airlineLogo.onload = function () {
        // Only apply if still showing the same flight
        if (flights[currentIndex] && flights[currentIndex].callsign === expectedCallsign) {
          this.classList.remove('hidden');
          els.airlineCode.classList.add('hidden');
        }
      };
      els.airlineLogo.onerror = function () {
        if (flights[currentIndex] && flights[currentIndex].callsign === expectedCallsign) {
          this.classList.add('hidden');
          els.airlineCode.textContent = fallbackCode;
          els.airlineCode.classList.remove('hidden');
        }
      };
      els.airlineLogo.src = logoUrl;
    }
    // Show logo optimistically (it may already be cached by browser)
    els.airlineLogo.classList.remove('hidden');
    els.airlineCode.classList.add('hidden');
  } else {
    els.airlineLogo.onerror = null;
    els.airlineLogo.onload = null;
    els.airlineLogo.classList.add('hidden');
    els.airlineCode.textContent = fallbackCode;
    els.airlineCode.classList.remove('hidden');
  }

  // Compass
  const newHeading = f.heading;
  if (newHeading !== null && newHeading !== undefined) {
    animateCompass(newHeading);
    els.headingReadout.textContent = Math.round(newHeading) + '\u00B0 ' + compassDirection(newHeading);
  } else {
    drawCompass(0, false);
    els.headingReadout.textContent = '---\u00B0';
  }

  // Aircraft count
  els.aircraftCount.textContent = flights.length + ' aircraft';

  // Pager dots
  els.pagerDots.innerHTML = '';
  const maxDots = Math.min(flights.length, 40);
  for (let i = 0; i < maxDots; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot' + (i === currentIndex ? ' active' : '');
    els.pagerDots.appendChild(dot);
  }
}

// --- Compass ---
function drawCompass(heading, showNeedle = true) {
  const canvas = els.compass;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = 138;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#334';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tick marks
  for (let deg = 0; deg < 360; deg += 10) {
    const rad = (deg - 90) * Math.PI / 180;
    const inner = deg % 30 === 0 ? r - 12 : r - 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
    ctx.lineTo(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r);
    ctx.strokeStyle = '#556';
    ctx.lineWidth = deg % 30 === 0 ? 2 : 1;
    ctx.stroke();
  }

  // Cardinal labels
  const labels = [
    { text: 'N', deg: 0, color: '#ff4444' },
    { text: 'E', deg: 90, color: '#c0c0d0' },
    { text: 'S', deg: 180, color: '#c0c0d0' },
    { text: 'W', deg: 270, color: '#c0c0d0' }
  ];

  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const l of labels) {
    const rad = (l.deg - 90) * Math.PI / 180;
    const lr = r - 24;
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, cx + Math.cos(rad) * lr, cy + Math.sin(rad) * lr);
  }

  // Needle
  if (showNeedle) {
    const rad = (heading - 90) * Math.PI / 180;
    const needleLen = r - 32;

    // Needle body
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(rad) * needleLen, cy + Math.sin(rad) * needleLen);
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Needle tip
    ctx.beginPath();
    ctx.arc(cx + Math.cos(rad) * needleLen, cy + Math.sin(rad) * needleLen, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4488ff';
    ctx.fill();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#6699ff';
    ctx.fill();
  }
}

function animateCompass(targetHeading) {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  if (animatingHeading === null) {
    animatingHeading = targetHeading;
    drawCompass(targetHeading);
    return;
  }

  const start = animatingHeading;
  let diff = targetHeading - start;

  // Shortest path
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  const duration = 800;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    const current = start + diff * eased;
    drawCompass(current);

    if (t < 1) {
      animationFrame = requestAnimationFrame(step);
    } else {
      animatingHeading = targetHeading;
      animationFrame = null;
    }
  }

  animationFrame = requestAnimationFrame(step);
}

// --- Cycling ---
function cycleNext() {
  if (flights.length === 0) return;
  currentIndex = (currentIndex + 1) % flights.length;
  countdownSeconds = 12;
  updateDisplay();
  animateEntry();
}

setInterval(() => {
  countdownSeconds--;
  if (countdownSeconds <= 0) {
    cycleNext();
  }
  els.countdown.textContent = flights.length > 0 ? `next ${countdownSeconds}s` : '';
}, 1000);

// --- Last seen updater ---
setInterval(() => {
  if (flights.length > 0) {
    const f = flights[currentIndex];
    if (f && f.lastSeen) {
      const ago = Math.round(Date.now() / 1000 - f.lastSeen);
      els.lastSeen.textContent = ago > 0 ? `seen ${ago}s ago` : 'just now';
    }
  }
}, 1000);

// Draw initial compass
drawCompass(0, false);
