# FlightKeys live-plan test harness

Open `test/flightkeys-live-fixture.html` from a local static HTTP server (not directly as a `file://` URL).

## Use

1. Select a live FlightKeys PDF.
2. Optionally select a JSON file containing independently verified expected values.
3. Run the parser.
4. Review every field and its findings.
5. Inspect the NOTAM text against the original PDF layout, including line breaks, indentation, continuation lines, headings and page boundaries.
6. Mark each discrepancy, enter the correct value as printed on the OFP, identify the source page/section, and add a note.
7. Download the JSON report and retain it with the test case for aggregation.

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

Only supplied dotted paths are compared. Values must be checked independently against the source OFP; this harness does not create ground truth.

## Discrepancy record

Each marked discrepancy is exported with:

- Parser field path and parsed value
- Corrected value entered by the tester
- Source page/section
- Tester note
- Review status (initially `unreviewed`)

These records are evidence for triage, not automatic parser patches. Aggregation should group repeat defects by field, layout pattern, and source format. A parser change requires root-cause review, a deterministic regression fixture/test, and a full rerun of the FlightKeys fixture set. Do not train parser logic directly from unreviewed crew corrections.

## NOTAM formatting is a preservation requirement

NOTAM text is operationally significant. The parser must **not** normalize NOTAM content into a generic prose string or discard visual structure. In particular:

- Preserve page boundaries and source order.
- Preserve line boundaries, paragraph breaks, indentation and continuation lines.
- Preserve spatial relationships between columns/blocks; do not concatenate adjacent columns into one sentence.
- Preserve headings, labels, validity periods, identifiers, punctuation and original text.
- Retain positioned PDF text items (coordinates, dimensions, font metadata and source order) alongside any reconstructed text.
- Expose both the raw NOTAM text block and its source-page/position metadata in the parser result. Do not rewrite, summarize, reflow, or interpret NOTAM grammar in the FlightKeys parser; the NOTAM ruleset owns interpretation.
- Where PDF text extraction cannot reliably preserve the visual layout, flag the block for review rather than silently guessing.

The harness passes both reconstructed text and per-page positioned text items to the parser. The NOTAM review preview displays extracted page text with line breaks and indentation retained. A reviewer must compare it to the original PDF; extracted text alone is not proof that layout was preserved exactly.

## Parser API

The page expects the browser global `OfpFlightKeys.parseFlightKeys({ text, pages })`. Each page contains its page number, dimensions, and positioned PDF text items, including source order. The parser must be deterministic, return the ADR-005 briefing contract, and report explicit findings for missing, empty, or unusual values.

This is an acceptance harness, not an operational release approval. A passing comparison means only that the supplied expected values match for this package.
