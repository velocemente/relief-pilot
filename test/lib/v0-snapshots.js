'use strict';
// V0 snapshot builders. Both take the result of importFixture() (app-path.js), i.e. the
// state the app is in after its real import path has run on a fixture.
const crypto = require('crypto');
const vm = require('vm');
const { notamKey } = require('./app-path');

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const norm = s => (s || '').replace(/\s+/g, ' ').trim();

// Identity of a NOTAM as the app itself keys duplicates (D43, evalNotams): the location(s)
// and the ID; a NOTAM with no readable ID is identified by its whitespace-normalised text.
function notamIdOf(notamRaw) {
  const k = notamKey(notamRaw);
  return k ? `${k.loc} ${k.id}` : `noid:${sha(norm(notamRaw)).slice(0, 12)}`;
}

// What src/airports.html evalAirport() hands to evalNotams(), for one release airport.
// QUOTED CALL SITE (src/airports.html, evalAirport):
//     const etaMin = pZM(etaZ);
//     ...
//     const notamArr  = _splitNotams(notamText);
//     const aptRole   = (role || 'DEST').toString().toUpperCase();
//     const evalRole  = aptRole === 'ORIG' ? 'ORIG' : 'DEST';
//     const nd        = _tlNotamDate(etaMs, etaMin);
//     const flightISO = nd.flightISO;
//     // Departure time: gives the UTC date of the ETA for the schedule checks.
//     const depMin    = nd.depMin;
//     const result    = evalNotams(notamArr, evalRole, etaMin, acftType || '', flightISO, depMin);
// with etaMs = _tlEtaMs(icao, role, etaZ) (D51 timeline, src/state.html). With no edit this is
// the flight date (DOF) and pZM(S.outZ), as before. A build without the timeline (before D51)
// is read as before: window._flightDateISO and pZM(S.outZ).
// and evalAirport() is called (buildAirportCards / refreshAptCard / descent screens) as
//     evalAirport(apt.icao, apt.eta, data.notams, data.weather, apt.wxWindow, apt.role, S.acftType)
// for every airport of getAllAirports(). evalNotams() is only called when the airport has
// NOTAM text (hN).
function evalArgsFor(imp, apt) {
  const { app, airportData, S } = imp;
  const data = airportData[apt.icao] || { notams: '', weather: '' };
  const notamText = data.notams;
  if (!(notamText && notamText.trim().length > 0)) return null;
  const etaMin = app.pZM(apt.eta);
  const notamArr = app._splitNotams(notamText);
  const aptRole = (apt.role || 'DEST').toString().toUpperCase();
  const evalRole = aptRole === 'ORIG' ? 'ORIG' : 'DEST';
  let flightISO = (app.sandbox.window && app.sandbox.window._flightDateISO) || '';
  let depMin = S ? app.pZM(S.outZ) : null;
  if (vm.runInContext("typeof _tlNotamDate === 'function'", app.sandbox)) {
    const j = JSON.stringify;
    const nd = vm.runInContext(`_tlNotamDate(${apt.eta == null ? null : `_tlEtaMs(${j(apt.icao)}, ${j(apt.role)}, ${j(apt.eta)})`}, ${etaMin})`, app.sandbox);
    flightISO = nd.flightISO; depMin = nd.depMin;
  }
  return { notamArr, evalRole, etaMin, acftType: S.acftType || '', flightISO, depMin };
}

function callEvalNotams(app, a, notamArr) {
  return app.evalNotamsAs(notamArr || a.notamArr, a.evalRole, a.etaMin, a.acftType, a.flightISO, a.depMin);
}

// NOTAM-evaluation golden: per release airport, the NOTAMs evalNotams() reports in effect
// at the OFP ETA, as sorted IDs, with the worst level.
function notamSnapshot(fx, imp) {
  const airports = imp.app.getAllAirports().map(apt => {
    const a = evalArgsFor(imp, apt);
    const row = { icao: apt.icao, role: apt.role, eta: apt.eta == null ? null : apt.eta };
    if (!a) return { ...row, notamChunks: 0, evaluated: false, ids: [], worst: null };
    const result = callEvalNotams(imp.app, a);
    const ids = result.issues.filter(i => i.notamRaw).map(i => notamIdOf(i.notamRaw)).sort();
    return { ...row, notamChunks: a.notamArr.length, evaluated: true, ids, worst: result.worst };
  });
  return { id: fx.id, format: fx.format, flightDateISO: imp.app.sandbox.window._flightDateISO, acftType: imp.S.acftType, airports };
}

// App-path golden: what the screens read after parseOFP() — state S, the per-airport data,
// the airport list with roles and ETAs, and each airport's card status from evalAirport().
function appSnapshot(fx, imp) {
  const { app, airportData, S } = imp;
  const state = { ...S };
  const raw = state.rawOFP || '';
  state.rawOFP = { chars: raw.length, sha256: sha(raw) };   // full text is in text/<id>.raw.txt
  const airports = app.getAllAirports();
  const status = airports.map(apt => {
    const data = airportData[apt.icao] || { notams: '', weather: '' };
    const st = app.evalAirport(apt.icao, apt.eta, data.notams, data.weather, apt.wxWindow, apt.role, S.acftType);
    return { icao: apt.icao, role: apt.role, color: st.color, isEwins: st.isEwins,
             issues: (st.issues || []).map(i => ({ level: i.level, text: i.text })) };
  });
  return { id: fx.id, format: fx.format, flightDateISO: app.sandbox.window._flightDateISO,
           state, airportData, airports, status };
}

module.exports = { notamSnapshot, appSnapshot, notamIdOf, evalArgsFor, callEvalNotams, norm, sha };
