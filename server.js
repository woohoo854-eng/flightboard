require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// --- Aircraft database ---
const aircraftDb = new Map();
const csvPath = path.join(__dirname, 'data', 'aircraftDatabase.csv');

function loadAircraftDb() {
  try {
    const data = fs.readFileSync(csvPath, 'utf8');
    const lines = data.split('\n');
    // Header: icao24, registration, manufacturericao, manufacturername, model, typecode, ...
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length >= 6 && cols[0]) {
        aircraftDb.set(cols[0].toLowerCase(), {
          registration: cols[1],
          manufacturer: cols[3],
          model: cols[4],
          typecode: cols[5]
        });
      }
    }
    console.log(`Loaded ${aircraftDb.size} aircraft from database`);
  } catch (err) {
    console.error('Failed to load aircraft database:', err.message);
  }
}

function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cols.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  cols.push(current);
  return cols;
}

loadAircraftDb();

// --- Notable flight rules ---
const { loadNotableRules, getNotableFlightInfo } = require('./notable');
const notableSeen = new Set();

try {
  loadNotableRules();
  console.log('Loaded notable flight rules from data/notable-rules.json');
} catch (err) {
  console.error(err.message);
}

// --- ICAO to airline lookup (loaded from OpenFlights) ---
let airlineMap = {};

function metersToFeet(meters) {
  return typeof meters === 'number' ? Math.round(meters * 3.28084) : null;
}

function metersPerSecondToKnots(ms) {
  return typeof ms === 'number' ? Math.round(ms * 1.94384) : null;
}

function metersPerSecondToFpm(ms) {
  return typeof ms === 'number' ? Math.round(ms * 196.8504) : null;
}

function haversineDistanceMi(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 3958.8; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingFromHome(lat, lon) {
  if (lat == null || lon == null) return null;
  const y = Math.sin((lon - HOME_LON) * Math.PI / 180) * Math.cos(lat * Math.PI / 180);
  const x = Math.cos(HOME_LAT * Math.PI / 180) * Math.sin(lat * Math.PI / 180) -
            Math.sin(HOME_LAT * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.cos((lon - HOME_LON) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

async function loadAirlineMap() {
  const OPENFLIGHTS_URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat';
  try {
    const res = await fetch(OPENFLIGHTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const map = {};
    for (const line of text.split('\n')) {
      // Format: id, name, alias, IATA, ICAO, callsign, country, active
      const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
      const name = cols[1] || null;
      const rawIata = cols[3];
      const iata = rawIata && rawIata.length === 2 && rawIata !== '\\N' && rawIata !== '-' ? rawIata : null;
      const icao = cols[4];
      if (icao && icao.length === 3 && icao !== '\\N' && icao !== '-') {
        map[icao] = { iata, name };
      }
    }
    airlineMap = map;
    console.log(`Loaded ${Object.keys(airlineMap).length} airline ICAO mappings from OpenFlights`);
  } catch (err) {
    console.error('Failed to load OpenFlights airline data:', err.message);
    // Fall back to local file if available
    try {
      const localMap = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'data', 'icao-iata-map.json'), 'utf8')
      );
      airlineMap = Object.fromEntries(Object.entries(localMap).map(([icao, iata]) => [icao, { iata, name: null }]));
      console.log(`Fell back to local airline map (${Object.keys(airlineMap).length} entries)`);
    } catch (e) {
      console.error('No local airline map available either');
    }
  }
}

// --- Priority ICAO->IATA overrides (takes precedence over airlines.dat) ---
const ICAO_IATA_OVERRIDES = {
  SWA: 'WN', UAL: 'UA', DAL: 'DL', AAL: 'AA',
  SKW: 'OO', FFT: 'F9', ASA: 'AS', JBU: 'B6'
};

// --- OpenSky OAuth2 ---
const CLIENT_ID = process.env.OPENSKY_CLIENT_ID;
const CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET;
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const API_URL = 'https://opensky-network.org/api/states/all';

// Bounding box: 12 mi buffer around Arvada (10 mi display range + headroom)
const HOME_LAT = 39.8028;
const HOME_LON = -105.0875;
const BUFFER_MI = 12;
const LAT_BUFFER = BUFFER_MI / 69;                                      // ~0.174
const LON_BUFFER = BUFFER_MI / (69 * Math.cos(HOME_LAT * Math.PI / 180)); // ~0.226

const BBOX = {
  lamin: HOME_LAT - LAT_BUFFER,
  lamax: HOME_LAT + LAT_BUFFER,
  lomin: HOME_LON - LON_BUFFER,
  lomax: HOME_LON + LON_BUFFER
};

const MAX_FLIGHTS = 10;

let accessToken = null;
let tokenExpiry = 0;
let flightData = { time: 0, states: [] };

async function getToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry - 30000) {
    return accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000;
  console.log('OAuth token acquired, expires in', data.expires_in, 'seconds');
  return accessToken;
}

function distFromHome(lat, lon) {
  if (lat == null || lon == null) return Infinity;
  const dLat = lat - HOME_LAT;
  const dLon = (lon - HOME_LON) * Math.cos(HOME_LAT * Math.PI / 180);
  return dLat * dLat + dLon * dLon;  // squared distance, fine for sorting
}

async function pollOpenSky() {
  try {
    const token = await getToken();
    const params = new URLSearchParams({
      lamin: BBOX.lamin,
      lamax: BBOX.lamax,
      lomin: BBOX.lomin,
      lomax: BBOX.lomax
    });

    const res = await fetch(`${API_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`OpenSky API error: ${res.status} ${text}`);
      return;
    }

    const data = await res.json();
    const now = Math.floor(Date.now() / 1000);

    if (data && data.states) {
      const states = data.states.map(s => {
        const icao24 = (s[0] || '').toLowerCase();
        const callsign = (s[1] || '').trim();
        const icaoPrefix = callsign.replace(/[0-9]/g, '').substring(0, 3);
        const airline = airlineMap[icaoPrefix];
        const iataCode = ICAO_IATA_OVERRIDES[icaoPrefix] || airline?.iata || null;
        const aircraft = aircraftDb.get(icao24);

        return {
          icao24,
          callsign,
          icaoPrefix,
          airlineIcao: icaoPrefix,
          airlineIata: iataCode,
          airlineName: airline?.name || null,
          origin_country: s[2],
          longitude: s[5],
          latitude: s[6],
          baroAltitude: s[7],
          onGround: s[8],
          velocity: s[9],
          heading: s[10],
          verticalRate: s[11],
          geoAltitude: s[13],
          lastSeen: s[4],
          registration: aircraft ? aircraft.registration : null,
          manufacturer: aircraft ? aircraft.manufacturer : null,
          model: aircraft ? aircraft.model : null,
          typecode: aircraft ? aircraft.typecode : null
        };
      }).filter(s => !s.onGround);

      // Sort by distance from home, closest first
      states.sort((a, b) => {
        const da = distFromHome(a.latitude, a.longitude);
        const db = distFromHome(b.latitude, b.longitude);
        return da - db;
      });

      flightData = {
        time: data.time || now,
        states: states.slice(0, MAX_FLIGHTS)
      };
      console.log(`Poll: ${states.length} airborne, showing ${flightData.states.length} closest`);
    } else {
      flightData = { time: now, states: [] };
      console.log('Poll: no states returned');
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

// Load airline map then start polling
loadAirlineMap().then(() => {
  pollOpenSky();
  setInterval(pollOpenSky, 30000);
});

// --- Logo cache setup ---
const logoDir = path.join(__dirname, 'public', 'assets', 'logos');

async function ensureLogoDir() {
  try {
    await fs.promises.mkdir(logoDir, { recursive: true });
  } catch (err) {
    console.error('Could not create logo directory:', err.message);
  }
}

function logoFilePath(icao) {
  return path.join(logoDir, `${icao}.png`);
}

function missingFilePath(icao) {
  return path.join(logoDir, `${icao}.missing`);
}

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

// --- Express routes ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/logo/:icao', async (req, res) => {
  const icao = String(req.params.icao || '').toUpperCase();
  if (!icao) {
    return res.status(400).send('ICAO required');
  }

  const pngPath = logoFilePath(icao);
  const sentinelPath = missingFilePath(icao);

  if (await fileExists(sentinelPath)) {
    return res.status(404).send('Logo not found');
  }

  if (await fileExists(pngPath)) {
    res.type('image/png');
    return fs.createReadStream(pngPath).pipe(res);
  }

  await ensureLogoDir();
  const logoUrl = `https://raw.githubusercontent.com/sexym0nk3y/airline-logos/main/logos/${icao}.png`;
  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'image/png,image/*;q=0.8,*/*;q=0.5',
    'Referer': 'https://github.com/',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive'
  };

  let logoRes;
  try {
    logoRes = await fetch(logoUrl, { headers: fetchHeaders });
  } catch (err) {
    console.error(`Logo fetch failed for ${icao}:`, err.message);
    return res.status(502).send('Logo fetch failed');
  }

  if (!logoRes.ok) {
    const text = await logoRes.text().catch(() => 'Unknown logo fetch error');
    console.error(`Logo fetch for ${icao} returned ${logoRes.status} ${logoRes.statusText} from ${logoUrl}`);
    console.error('Response text:', text.slice(0, 200));
    if (logoRes.status === 404) {
      try {
        await fs.promises.writeFile(sentinelPath, '');
      } catch (err) {
        console.error(`Failed to write missing sentinel for ${icao}:`, err.message);
      }
      return res.status(404).send('Logo not found');
    }
    return res.status(logoRes.status).send(text);
  }

  const buffer = Buffer.from(await logoRes.arrayBuffer());
  try {
    await fs.promises.writeFile(pngPath, buffer);
  } catch (err) {
    console.error(`Failed to cache logo ${icao}:`, err.message);
  }

  res.type('image/png');
  res.send(buffer);
});

app.get('/api/aircraft', (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const aircraft = flightData.states
    .map(s => {
      const distanceMi = haversineDistanceMi(HOME_LAT, HOME_LON, s.latitude, s.longitude);
      if (distanceMi > 10) return null;
      const altitudeFt = metersToFeet(s.baroAltitude != null ? s.baroAltitude : s.geoAltitude);
      const verticalRateFpm = metersPerSecondToFpm(s.verticalRate);
      const notableInfo = getNotableFlightInfo({
        typecode: s.typecode,
        registration: s.registration,
        altitude: altitudeFt,
        verticalRate: verticalRateFpm
      });

      if (notableInfo.notable && !notableSeen.has(s.icao24)) {
        notableSeen.add(s.icao24);
        console.log(`Notable: ${s.callsign || 'unknown'} (${s.icao24}) - ${notableInfo.notableReason}`);
      }

      return {
        icao24: s.icao24,
        callsign: s.callsign || null,
        lat: s.latitude,
        lon: s.longitude,
        altitude: altitudeFt,
        velocity: metersPerSecondToKnots(s.velocity),
        heading: typeof s.heading === 'number' ? Number(s.heading.toFixed(1)) : null,
        verticalRate: verticalRateFpm,
        onGround: s.onGround,
        distanceMi: Number(distanceMi.toFixed(1)),
        bearing: Number(bearingFromHome(s.latitude, s.longitude).toFixed(1)),
        origin_country: s.origin_country,
        registration: s.registration || null,
        manufacturer: s.manufacturer || null,
        model: s.model || null,
        typecode: s.typecode || null,
        airlineIcao: s.airlineIcao || null,
        airlineIata: s.airlineIata || null,
        airlineName: s.airlineName || null,
        notable: notableInfo.notable,
        notableReason: notableInfo.notableReason
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .slice(0, MAX_FLIGHTS);

  res.json({
    location: { lat: HOME_LAT, lon: HOME_LON, name: 'Arvada CO' },
    rangeMiles: 10,
    count: aircraft.length,
    timestamp: now,
    featured: aircraft.length > 0 ? aircraft[0].icao24 : null,
    aircraft
  });
});

// DEPRECATED: kept for bar-screen compatibility, safe to remove once no clients call it.
app.get('/api/flight', (req, res) => {
  res.json(flightData);
});

app.get('/api/flights', (req, res) => {
  res.json(flightData);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FlightBoard running on http://0.0.0.0:${PORT}`);
});
