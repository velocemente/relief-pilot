#!/usr/bin/env node
// NOTAM-evaluation golden: for every fixture and every release airport the app evaluates
// (ORIG, DEST, alternates), evalNotams() is called exactly as src/airports.html does, at
// the OFP ETA, on the NOTAM text the app's own import path stored for that airport.
// Snapshot per airport: role, ETA, sorted IDs of the NOTAMs in effect, worst level.
//   node test/golden/notam.js compare|update [--fixtures <dir>]   (snapshots-notam/<id>.json)
'use strict';
const { run } = require('../lib/snapshot-runner');
const { notamSnapshot } = require('../lib/v0-snapshots');
run({ name: 'notam', dirName: 'snapshots-notam', build: notamSnapshot }).catch(e => { console.error(e); process.exit(1); });
