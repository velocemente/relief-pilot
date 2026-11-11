# FlightKeys live-plan test harness

Open `test/flightkeys-live-fixture.html` from a local static HTTP server (not directly as a `file://` URL).

## Use

1. Select a live FlightKeys PDF.
2. Optionally select a JSON file containing independently verified expected values.
3. Run the parser.
4. Review the returned contract and findings, including safety-critical findings.
5. Download the JSON report for the test record.

The PDF is read in the browser using PDF.js **3.11.174** and is not sent to a server. The only external request in the default setup is loading the pinned PDF.js library and worker from cdnjs. For offline use, serve the same pinned PDF.js distribution locally and update the two script/worker URLs.

## Expected-values JSON

```json
{
  "expected": {
    "fltNum": "GTI874/02",
    "origIcao": "ZHEC",
    "destIcao": "PANC",
    "blockFuelRaw": "120000"
  }
}
```

Only the supplied dotted paths are compared. Values must be checked independently against the source OFP; this harness does not create ground truth.

## Parser API

The page expects the browser global `OfpFlightKeys.parseFlightKeys({ text, pages })`. Each page contains its page number, dimensions, and positioned PDF text items. The parser must be deterministic, return the ADR-005 briefing contract, and report explicit findings for missing, empty, or unusual values.

This is an acceptance harness, not an operational release approval. A passing comparison means only that the supplied expected values match for this package.
