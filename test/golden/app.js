#!/usr/bin/env node
// App-path golden: the app's real import path on every fixture — stored pdf.js items ->
// processPDF() line assembly -> parseOFP() — snapshotting the state the screens read
// (S, airportData, airport list, per-airport card status from evalAirport()).
//   node test/golden/app.js compare|update [--fixtures <dir>]   (snapshots-app/<id>.json)
'use strict';
const { run } = require('../lib/snapshot-runner');
const { appSnapshot } = require('../lib/v0-snapshots');
run({ name: 'app', dirName: 'snapshots-app', build: appSnapshot }).catch(e => { console.error(e); process.exit(1); });
