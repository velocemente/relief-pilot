'use strict';
// V0 helpers: run the app's REAL import path on a fixture, without editing index.html.
//
//   stored pdf.js items (fixtures items/<id>.items.json)
//     -> processPDF()  (the app's own line assembly, index.html / src/pdf.html)
//     -> parseOFP()    (the app's own parse + merge into S and airportData)
//
// pdf.js itself is replaced by a stand-in whose getTextContent() returns the stored
// items in the shape pdf.js gives them (str, transform[4] = x, transform[5] =
// viewport height - y, width). Everything after getTextContent is the app's code.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadApp } = require('../harness');

function findFixtures(explicit) {
  const root = path.resolve(__dirname, '..', '..');
  const candidates = [explicit, process.env.PB_FIXTURES, path.join(root, 'fixtures'),
                      path.join(root, '..', 'pilotbrief-fixtures')].filter(Boolean);
  return candidates.find(d => fs.existsSync(path.join(d, 'manifest.json'))) || null;
}

// Fixtures the golden snapshot compares select: every fixture except the live FlightKeys
// packages (manifest format "flightkeys" with source.type "live"), which are added without
// snapshots. Any selected fixture without a snapshot still FAILS.
const isLiveFlightKeys = fx => fx.format === 'flightkeys' && !!fx.source && fx.source.type === 'live';
const snapshotFixtures = manifest => manifest.fixtures.filter(fx => !isLiveFlightKeys(fx));

// Missing fixtures are a FAILURE, never a skip (V0 rule 4).
function requireFixtures(explicit) {
  const dir = findFixtures(explicit);
  if (!dir) throw new Error('fixtures not found (set PB_FIXTURES, pass --fixtures, or clone pilotbrief-fixtures beside the repo)');
  return dir;
}

function readManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
}

// A pdf.js document stand-in built from <id>.items.json.
function fakePdfjs(itemsDoc) {
  const pages = itemsDoc.pages;
  const doc = {
    numPages: pages.length,
    getPage: async n => {
      const pg = pages[n - 1];
      return {
        getViewport: () => ({ width: pg.width, height: pg.height }),
        getTextContent: async () => ({
          items: pg.items.map(it => ({
            str: it.str,
            transform: [0, 0, 0, 0, it.x, pg.height - it.y],
            width: it.w,
            height: it.h,
            fontName: it.font,
          })),
        }),
      };
    },
  };
  return { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve(doc) }) };
}

// Read a top-level variable of the app script (let/const are not sandbox properties).
function peek(app, expr) {
  return vm.runInContext(expr, app.sandbox);
}

// Runs processPDF() and then the parseOFP() it schedules (setTimeout 400 ms in the app).
// Returns { app, rawText, airportData, S } after the import has finished.
async function importFixture(fx, fixturesDir, opts = {}) {
  const itemsDoc = JSON.parse(fs.readFileSync(path.join(fixturesDir, fx.files.items), 'utf8'));
  const app = loadApp({ html: opts.html });
  const timers = [];
  app.sandbox.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  app.sandbox.pdfjsLib = fakePdfjs(itemsDoc);
  // loadPdfJs() (src/import.html, a separate inline script the harness does not load) only
  // fetches pdf.js from the CDN; the test supplies pdfjsLib itself, so no network is used.
  app.sandbox.loadPdfJs = async () => {};
  const file = { name: path.basename(fx.files.pdf), type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(8) };
  await app.processPDF(file);
  // processPDF: setTimeout(() => { parseOFP(); push('screen-flight'); }, 400). The toast
  // timers (3500 ms) are ignored.
  const parse = timers.filter(t => t.ms === 400);
  if (parse.length !== 1) throw new Error(`${fx.id}: processPDF scheduled ${parse.length} import timers, expected 1`);
  parse[0].fn();   // parseOFP(); push('screen-flight')
  return {
    app,
    rawText: peek(app, 'pdfRawText'),
    airportData: peek(app, 'airportData'),
    S: app.S,
  };
}

// NOTAM header: "- ICAO [ICAO ...] A1234/YY ..." -> { loc, id } (D43 key, as evalNotams builds it).
const NOTAM_ID_RE = /^\s*-\s+((?:[A-Z]{4}\s+)+)([A-Z]\d{1,4}\/\d{2})(?=\s|$)/;
function notamKey(notamRaw) {
  const m = (notamRaw || '').match(NOTAM_ID_RE);
  if (m) return { loc: m[1].trim().split(/\s+/).join(' '), id: m[2] };
  return null;
}

module.exports = { findFixtures, requireFixtures, readManifest, importFixture, peek, notamKey, NOTAM_ID_RE,
                   isLiveFlightKeys, snapshotFixtures };
