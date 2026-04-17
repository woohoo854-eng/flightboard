const fs = require('fs');
const path = require('path');

let notableRules = null;

function loadNotableRules(rulesPath = path.join(__dirname, 'data', 'notable-rules.json')) {
  try {
    notableRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    return notableRules;
  } catch (err) {
    notableRules = null;
    throw new Error(`Failed to load notable rules from ${rulesPath}: ${err.message}`);
  }
}

function getNotableFlightInfo({ typecode, registration, altitude, verticalRate }) {
  if (!notableRules) {
    return { notable: false, notableReason: null };
  }

  const typeCodeUpper = String(typecode || '').toUpperCase();
  const regUpper = String(registration || '').toUpperCase();

  const prefixes = notableRules.typeCodePrefixes || {};
  if (typeCodeUpper) {
    for (const prefix of prefixes.cargo || []) {
      if (typeCodeUpper.startsWith(prefix)) {
        return { notable: true, notableReason: 'Cargo / special' };
      }
    }
    for (const prefix of prefixes.widebody || []) {
      if (typeCodeUpper.startsWith(prefix)) {
        return { notable: true, notableReason: 'Wide-body long-haul' };
      }
    }
    for (const prefix of prefixes.privateJet || []) {
      if (typeCodeUpper.startsWith(prefix)) {
        return { notable: true, notableReason: 'Private jet' };
      }
    }
  }

  if (regUpper && notableRules.specialRegistrations && notableRules.specialRegistrations[regUpper]) {
    return { notable: true, notableReason: notableRules.specialRegistrations[regUpper] };
  }

  const altitudeThreshold = notableRules.altitudeThresholdFt;
  if (typeof altitude === 'number' && altitude > altitudeThreshold) {
    return { notable: true, notableReason: 'High altitude' };
  }

  const verticalRateThreshold = notableRules.verticalRateThresholdFpm;
  if (typeof verticalRate === 'number' && Math.abs(verticalRate) > verticalRateThreshold) {
    return { notable: true, notableReason: 'Aggressive climb/descent' };
  }

  return { notable: false, notableReason: null };
}

module.exports = {
  loadNotableRules,
  getNotableFlightInfo
};
