# FlightBoard

Flight tracking wall display for Raspberry Pi 4.

## Stack

- **Backend:** Node.js/Express on port 3001
- **Frontend:** Single HTML/CSS/JS page, no framework, full screen
- **Service:** systemd unit `flightboard.service`
- **Platform:** Raspberry Pi OS Lite 64-bit, Node.js v20, npm 9

## OpenSky API

- OAuth2 client credentials flow
- Credentials in `.env` file (`CLIENT_ID`, `CLIENT_SECRET`)
- Bounding box: lat 39.35–40.25, lon -105.55–-104.60 (50 nm around Arvada, CO)
- Poll every 30 seconds
- Endpoint: `/api/states/all` with `lamin`, `lamax`, `lomin`, `lomax` params

## Aircraft Database

- Source: OpenSky aircraft database CSV from opensky-network.org/datasets/metadata
- Saved to `data/aircraftDatabase.csv`
- Lookup aircraft type by ICAO24 hex address from state vector

## Display Design

### Layout

Three-zone letterbox layout for wide thin screen (~2:1 aspect ratio). Background: `#080810`.

### Left Zone — Airline ID

- Airline logo from `images.kiwi.com/airlines/64/XX.png` using IATA code
- IATA code mapped from ICAO callsign prefix (first 3 letters)
- Fallback: show ICAO prefix text if no logo
- General aviation fallback: show "GA"

### Center Zone — Flight Data

- Callsign: large, bright white
- Aircraft type: from bundled CSV lookup by ICAO24
- Vertical rate badge: climbing (green) / descending (red) / level (gray)
- Altitude: in feet, amber color
- Speed: in knots
- Seconds since last seen

### Right Zone — Compass Rose

- Fixed ring with N/S/E/W labels
- Blue needle rotates smoothly to true heading
- Red "N" label
- Degree readout below center
- Needle animates between headings on flight change

### Top Bar

- Location label: "Arvada CO"
- Live green dot (pulses when data is fresh)
- Clock

### Bottom Bar

- Aircraft count
- Pager dots (one per tracked flight)
- Countdown timer to next flight card

### Cycling

- One flight card at a time
- Cycles every 10 seconds

## Critical Display Rules

- Text must be very bright — white or near-white for primary text
- No dark gray text — must be readable from across a room
- Font sizes large — this is a physical wall display
- No route data — OpenSky does not provide origin/destination

## File Structure

```
~/flightboard/
  CLAUDE.md
  .env                  # CLIENT_ID, CLIENT_SECRET
  package.json
  server.js             # Express backend, OpenSky polling, API endpoints
  public/
    index.html          # Single-page frontend
    style.css
    app.js              # Frontend logic, cycling, compass animation
  data/
    aircraftDatabase.csv
    icao-iata-map.json  # ICAO callsign prefix -> IATA airline code
```

## Commands

```bash
npm install             # Install dependencies
npm start               # Start server (node server.js)
sudo systemctl start flightboard   # Start via systemd
sudo systemctl status flightboard  # Check status
```
