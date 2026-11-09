'use strict';
// How the app calls evalNotams() since the aircraft-profile integration (NOTAM ruleset v1.12.0).
// QUOTED CALL SITE (src/airports.html, evalAirport):
//     const acftProfile = AircraftProfile.buildAcftProfile(acftType || '');
//     const result    = evalNotams(notamArr, evalRole, etaMin, acftProfile, flightISO, depMin, AircraftProfile.getWingspan);
// The NOTAM module holds no aircraft data: a test that calls evalNotams() directly with an ICAO type
// string gets the unknown profile (no aircraft filter). A test that means "the aircraft is B744" builds
// the profile with the aircraft-profile module and passes it, exactly like this.
const fs = require('fs');
const path = require('path');

const RULES = path.resolve(__dirname, '..', '..', 'rules');

// The aircraft-profile module file listed in rules/manifest.json, loaded in Node.
function nodeAircraftProfile() {
  const m = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
  return require(path.join(RULES, m['aircraft-profile'].file));
}

// evalNotams: any copy of the NOTAM module's evalNotams; AircraftProfile: the aircraft-profile
// module (the one built into the app, or nodeAircraftProfile()). acftType: the ICAO type string
// the app holds (S.acftType).
function callAsApp(evalNotams, AircraftProfile, notams, role, etaMin, acftType, flightISO, depMin) {
  const acftProfile = AircraftProfile.buildAcftProfile(acftType || '');
  return evalNotams(notams, role, etaMin, acftProfile, flightISO, depMin, AircraftProfile.getWingspan);
}

module.exports = { nodeAircraftProfile, callAsApp };
