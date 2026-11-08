#!/usr/bin/env node
// D51 corpus check: weather and NOTAM evaluation on every NavBlue / eOFP fixture, no edits,
// before (main's index.html) and after (this index.html) the D-EVAL timeline.
//
//   node test/corpus/deval-weather-changes.js --old <index.html> [--fixtures <dir>] [--out <file.md>]
//
// For every release airport (getAllAirports(), after the app's real import path):
//   - NOTAMs: the NOTAM IDs evalAirport() shows must be identical before and after
//     (module v1.11.1 already checks both days). Any difference → exit 1.
//   - Weather: the TAF groups extractEtaWindow() selects and the weather status
//     evalAirport() gives. Every airport where either changes is listed. A change is
//     explained only when the airport's ETA is on a different UTC day than the flight
//     date (DOF). A change with the ETA on the flight date whose TAF validity crosses
//     a month end (e.g. 3018/0124) comes from the month-end reading of TAF days; it is
//     listed apart, for the Exec to confirm, and also exits 1. Any other change → exit 1.
// Writes a Markdown table (IDs, ICAO codes, dates, times and statuses only; no fixture
// text, no crew data).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { importFixture, readManifest, requireFixtures } = require('../lib/app-path');

function parseArgs(argv) {
  const o = { old: null, fixtures: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--old') o.old = argv[++i];
    else if (argv[i] === '--fixtures') o.fixtures = argv[++i];
    else if (argv[i] === '--out') o.out = argv[++i];
    else { console.error(`unknown argument: ${argv[i]}`); process.exit(2); }
  }
  if (!o.old) { console.error('--old <index.html> (the build before this change) is required'); process.exit(2); }
  return o;
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAY = 86400000;
const fmtMs = ms => { const d = new Date(ms); return `${String(d.getUTCDate()).padStart(2, '0')} ${MON[d.getUTCMonth()]} ${d.toISOString().slice(11, 16).replace(':', '')}Z`; };
const hm = s => { const c = String(s || '').replace(/\D/g, ''); return c.length === 4 ? (+c.slice(0, 2)) * 60 + (+c.slice(2)) : null; };

// The evaluation window extractEtaWindow() uses, as UTC dates and times: ETA ± 60 min, or
// the OFP / E-WINS window. iso = the anchor date; shiftAfterMidnight = the D51 rule for a
// window that crosses 0000Z with the ETA in its after-midnight part.
function windowText(iso, etaMin, override, shiftAfterMidnight) {
  if (!iso || (etaMin === null && !override)) return '—';
  const day = Date.parse(iso + 'T00:00:00Z');
  const wm = override ? override.match(/(\d{4})Z-(\d{4})Z/i) : null;
  if (wm) {
    const ws = hm(wm[1]), we = hm(wm[2]);
    const d = (shiftAfterMidnight && etaMin !== null && we < ws && etaMin <= we) ? day - DAY : day;
    const s = d + ws * 60000;
    let e = d + we * 60000; if (e < s) e += DAY;
    return `${fmtMs(s)}–${fmtMs(e)}`;
  }
  const eta = day + (etaMin || 0) * 60000;
  return `${fmtMs(eta - 3600000)}–${fmtMs(eta + 3600000)}`;
}

// Selected TAF groups: count of group keywords in the extracted text (no text kept).
const groupsOf = s => (String(s || '').match(/\bFM\d{6}\b|\bTEMPO\b|\bBECMG\b|\bPROB\d{2}\b/g) || []);
const wxLevel = st => {
  const order = ['green', 'yellow', 'red'];
  let w = null;
  for (const i of st.wxIssues || []) if (w === null || order.indexOf(i.level) > order.indexOf(w)) w = i.level;
  return w || 'none';
};
const notamIds = st => {
  const ids = [];
  for (const [, g] of st.rwyGroups || []) for (const it of g.items || []) ids.push(it.notamRaw || it.text || '');
  for (const it of [...(st.sidIssues || []), ...(st.starIssues || [])]) ids.push(it.notamRaw || it.text || '');
  return ids.map(s => s.split('\n')[0].trim()).sort();
};

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const fixturesDir = requireFixtures(opt.fixtures);
  const oldHtml = fs.readFileSync(path.resolve(opt.old), 'utf8');
  const fixtures = readManifest(fixturesDir).fixtures.filter(fx => fx.format !== 'flightkeys');

  const rows = [], bad = [];
  let airports = 0, wxAirports = 0, notamAirports = 0, nextDay = 0;
  for (const fx of fixtures) {
    const before = await importFixture(fx, fixturesDir, { html: oldHtml });
    const after = await importFixture(fx, fixturesDir);
    const dof = after.app.sandbox.window._flightDateISO;
    const aptsB = before.app.getAllAirports(), aptsA = after.app.getAllAirports();
    if (JSON.stringify(aptsB) !== JSON.stringify(aptsA)) bad.push(`${fx.id}: airport list differs`);
    for (const apt of aptsA) {
      airports++;
      const eval_ = imp => {
        const data = imp.airportData[apt.icao] || { notams: '', weather: '' };
        return imp.app.evalAirport(apt.icao, apt.eta, data.notams, data.weather, apt.wxWindow, apt.role, imp.S.acftType);
      };
      const stB = eval_(before), stA = eval_(after);
      const etaMs = vm.runInContext(`_tlEtaMs(${JSON.stringify(apt.icao)}, ${JSON.stringify(apt.role)}, ${JSON.stringify(apt.eta)})`, after.app.sandbox);
      const etaISO = etaMs == null ? null : new Date(etaMs).toISOString().slice(0, 10);
      if (etaISO && etaISO !== dof) nextDay++;

      // NOTAMs: identical before and after.
      const nB = notamIds(stB), nA = notamIds(stA);
      if (nB.length || nA.length) notamAirports++;
      if (JSON.stringify(nB) !== JSON.stringify(nA)) bad.push(`${fx.id} ${apt.icao} ${apt.role}: NOTAMs shown differ (${nB.length} → ${nA.length})`);

      // Weather: selected TAF groups and status.
      const ap = after.airportData[apt.icao] || {};
      const ew = ap.ewinsWeather && ap.ewinsWeather.trim();
      const wx = ew ? ap.ewinsWeather : ap.weather;
      if (!(wx && wx.trim())) continue;
      wxAirports++;
      const win = ew ? (ap.ewinsWindow || apt.wxWindow) : apt.wxWindow;
      const etaMin = hm(apt.eta);
      const selB = before.app.extractEtaWindow(wx, etaMin, win);
      const selA = after.app.extractEtaWindow(wx, etaMin, win, etaISO);
      const lvB = wxLevel(stB), lvA = wxLevel(stA);
      const textsB = JSON.stringify((stB.wxIssues || []).map(i => i.text)), textsA = JSON.stringify((stA.wxIssues || []).map(i => i.text));
      if (selB === selA && lvB === lvA && textsB === textsA && stB.color === stA.color) continue;
      const explained = !!etaISO && etaISO !== dof;
      // TAF validity DDHH/DDHH whose end day is before its start day: crosses a month end.
      const val = String(wx).match(/TAF(?:\s+AMD)?\s+[A-Z]{4}\s+\d{6}Z\s+(\d{2})\d{2}\/(\d{2})\d{2}/i);
      const monthEnd = !explained && !!val && parseInt(val[2], 10) < parseInt(val[1], 10);
      if (!explained) bad.push(`${fx.id} ${apt.icao} ${apt.role}: weather changed with the ETA on the flight date` +
        (monthEnd ? ' (TAF validity crosses a month end; Exec to confirm)' : ''));
      rows.push({
        fx: fx.id, icao: apt.icao, role: apt.role, dof, etaISO: etaISO || '—', eta: apt.eta,
        oldWin: windowText(dof, etaMin, win, false), newWin: windowText(etaISO, etaMin, win, true),
        groups: `${groupsOf(selB).length} → ${groupsOf(selA).length}${selB === selA ? ' (same)' : ''}`,
        wx: `${lvB} → ${lvA}`, card: `${stB.color} → ${stA.color}`, ewins: !!ew, explained, monthEnd,
        validity: val ? `${val[1]}→${val[2]}` : '—',
      });
    }
  }

  const statusChanged = rows.filter(r => r.wx.split(' → ')[0] !== r.wx.split(' → ')[1] || r.card.split(' → ')[0] !== r.card.split(' → ')[1]).length;
  const lines = [];
  lines.push('# D-EVAL dates (D51): weather evaluation changes on the corpus');
  lines.push('');
  lines.push('Generated by `test/corpus/deval-weather-changes.js` (no edits; app import path on every NavBlue / eOFP fixture).');
  lines.push('Before = `main` (window anchored on the flight date). After = this change (window anchored on the airport\'s own ETA date from the timeline).');
  lines.push('Only IDs, ICAO codes, dates, times and statuses; no fixture text, no crew data.');
  lines.push('');
  lines.push(`- Fixtures: ${fixtures.length} · release airports: ${airports} · with weather: ${wxAirports} · with NOTAMs shown: ${notamAirports}`);
  lines.push(`- Airports whose ETA is on a different UTC day than the flight date: ${nextDay}`);
  lines.push(`- Airports whose selected TAF groups or weather status change: **${rows.length}** (status or card colour changes: ${statusChanged}; TAF groups only: ${rows.length - statusChanged})`);
  lines.push(`- Explained by the ETA being on a different UTC day than the flight date: **${rows.filter(r => r.explained).length}**`);
  lines.push(`- Not explained by the ETA date: **${rows.filter(r => !r.explained).length}** (of which TAF validity crossing a month end, ETA on the flight date: ${rows.filter(r => r.monthEnd).length}; see the last table)`);
  lines.push(`- NOTAM results changed: **${bad.filter(b => /NOTAMs/.test(b)).length}**`);
  lines.push('');
  lines.push('Window = the evaluation window as UTC date and time (ETA ± 60 min, or the OFP CFS / E-WINS window). TAF groups = FM/TEMPO/BECMG/PROB groups selected (count). Weather = worst weather level on the card; Card = card colour (weather and NOTAMs).');
  lines.push('');
  lines.push('| Package | Airport | Role | Flight date | ETA date | ETA | Old window | New window | TAF groups | Weather | Card |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  const row = r => `| ${r.fx} | ${r.icao}${r.ewins ? ' (E-WINS)' : ''} | ${r.role} | ${r.dof} | ${r.etaISO} | ${r.eta}Z | ${r.oldWin} | ${r.newWin} | ${r.groups} | ${r.wx} | ${r.card} |`;
  for (const r of rows.filter(r => r.explained)) lines.push(row(r));
  lines.push('');
  const other = rows.filter(r => !r.explained);
  lines.push('## Not explained by the ETA date (STOP rule of the brief: Exec to confirm)');
  lines.push('');
  if (!other.length) lines.push('None.');
  else {
    lines.push('ETA on the flight date. The TAF validity (day → day) crosses a month end: before, a TAF day of the previous month (e.g. 30) was read as later than day 01 of the ETA month, so the FM group in force at the ETA was not selected. After, each TAF day is read in the month nearest the ETA date (brief step 4, month-end).');
    lines.push('');
    lines.push('| Package | Airport | Role | Flight date | ETA date | ETA | TAF validity days | Old window | New window | TAF groups | Weather | Card |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of other) lines.push(`| ${r.fx} | ${r.icao}${r.ewins ? ' (E-WINS)' : ''} | ${r.role} | ${r.dof} | ${r.etaISO} | ${r.eta}Z | ${r.validity}${r.monthEnd ? ' (month end)' : ''} | ${r.oldWin} | ${r.newWin} | ${r.groups} | ${r.wx} | ${r.card} |`);
  }
  lines.push('');
  const md = lines.join('\n') + '\n';
  if (opt.out) fs.writeFileSync(path.resolve(opt.out), md);
  else process.stdout.write(md);

  console.error(`${rows.length} weather change(s), ${bad.length} problem(s)`);
  if (bad.length) { bad.forEach(b => console.error('STOP: ' + b)); process.exit(1); }
}

main().catch(e => { console.error(e); process.exit(1); });
