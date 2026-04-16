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

// --- ICAO to IATA airline map (loaded from OpenFlights) ---
let icaoIataMap = {};

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
      const iata = cols[3];
      const icao = cols[4];
      if (icao && icao.length === 3 && icao !== '\\N' && icao !== '-' &&
          iata && iata.length === 2 && iata !== '\\N' && iata !== '-') {
        map[icao] = iata;
      }
    }
    icaoIataMap = map;
    console.log(`Loaded ${Object.keys(icaoIataMap).length} airline ICAO->IATA mappings from OpenFlights`);
  } catch (err) {
    console.error('Failed to load OpenFlights airline data:', err.message);
    // Fall back to local file if available
    try {
      icaoIataMap = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'data', 'icao-iata-map.json'), 'utf8')
      );
      console.log(`Fell back to local airline map (${Object.keys(icaoIataMap).length} entries)`);
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

// Bounding box: ~13nm around Arvada, CO (39.8028, -105.0875)
const BBOX = {
  lamin: 39.591,
  lamax: 40.014,
  lomin: -105.326,
  lomax: -104.826
};

const HOME_LAT = 39.8028;
const HOME_LON = -105.0875;
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
        const iataCode = ICAO_IATA_OVERRIDES[icaoPrefix] || icaoIataMap[icaoPrefix] || null;
        const aircraft = aircraftDb.get(icao24);

        return {
          icao24,
          callsign,
          icaoPrefix,
          iataCode,
          country: s[2],
          longitude: s[5],
          latitude: s[6],
          baroAltitude: s[7],
          onGround: s[8],
          velocity: s[9],
          heading: s[10],
          verticalRate: s[11],
          geoAltitude: s[13],
          lastSeen: s[4],
          aircraftType: aircraft ? (aircraft.typecode || aircraft.model || '') : '',
          registration: aircraft ? aircraft.registration : ''
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

// --- Express routes ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/flights', (req, res) => {
  res.json(flightData);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FlightBoard running on http://0.0.0.0:${PORT}`);
});
