# PilotBrief 1.11.0 Release Notes

## What's New

Changes you will see on FlightKeys flights, unless a line says otherwise.

- **Dispatch contact.** The Dispatch contact row shows the sentence the OFP prints. If the OFP prints none, there is no row. A sentence that tells you not to contact Dispatch gives no row.
- **Volcanic ash in OFP Alerts.** When an OFP remark mentions volcanic ash and no matching advisory is printed, OFP Alerts shows "VOLCANIC ASH ROUTING IN OFP REMARKS – CHECK ROUTE". When the OFP prints a matching advisory, OFP Alerts shows "VOLCANIC ASH ADVISORY FOR THIS FLIGHT – SEE OFP REMARKS AND THE VA PAGE ON THE OFP TAB" instead.
- **RAIM.** A RAIM warning is shown in OFP Remarks as printed. It is not shown when the OFP prints "RAIM validation passed", for the flight or for an ETOPS alternate.
- **OFP Remarks opens by itself** for a security message, an instruction to contact Dispatch, a volcanic ash remark or a RAIM warning. Tap its title to close it.
- **En-route FIR groups.** A FIR group that holds a volcanic ash item is open when you reach it. Tap its title to close it.
- **Perishables.** The perishables banner shows only when the OFP prints YES.
- **OFP Remarks text.** The OFP Remarks entries and the security message read as plain notes text. The security message is last.
- **Company Remarks on airport cards (NavBlue flights too).** The Company Remarks title and the dot of each remark are blue. A Company NOTAM about an ETOPS alternate shows one line: "Suitable Airport - Refer to Company NOTAMS". A remark that restricts or authorises an approach or a runway procedure keeps its yellow dot.
- **Saved flights.** Flights saved in 1.10.0 open as before, except for the OFP Remarks group of a FlightKeys flight: it now shows the Dispatch contact sentence and any RAIM warning as printed, read again from the stored PDF. If the PDF cannot be read, a flight saved with a Dispatch contact shows "Review OFP Remarks" in the Dispatch contact row. Such a flight does not get the new volcanic ash alert or the open FIR groups until you import the package again.

---

## Known Limits

- A suggestion to contact Dispatch (for example "with questions") leaves the OFP Remarks group closed; open it to see the row.
- A North Atlantic advisory can show on a flight that isn't on a track.
- ETOPS alternate details (hours, contacts, fire category) are not shown in the app; refer to the Company NOTAMs in the package. NavBlue airport cards do not show the Suitable Airport line.
- Some curfew and take-off or landing prohibition remarks in Company Remarks show blue instead of the alert colour. Read every Company Remarks line.
- Obstacle NOTAMs cited in the Takeoff and Landing Report are hidden like other obstacle NOTAMs when they affect no procedure - check the report's NOTAM list.
- NOTAMs printed with the year after the time are flagged "DATE NOT READABLE – CHECK NOTAM" although they are valid.
- Pasted FlightKeys text has no briefing NOTAMs or weather; a warning shows on the Preflight card.
- If the stored PDF is missing, the OFP tab is empty after a reload.
- En-route obstacle NOTAMs (MEA / MOCA) are treated inconsistently.

---

# PilotBrief 1.10.0 Release Notes

## What's New

FlightKeys packages are now read by the app. The NavBlue reader is unchanged, but the shared NOTAM rules, OFP Alerts, rest chips and the way flights are saved also apply to NavBlue flights.

---

## NOTAMs

The NOTAM rules now run from the updated versions 1.13.0 and 1.14.0. What you will notice:

- **FlightKeys NOTAMs are read as printed.** Each NOTAM is kept on its own ID; NOTAMs with different IDs are never merged. Times are read as UTC, on their actual date, against the airport's time window for its role in the flight.
- **A NOTAM whose dates cannot be read is always shown.** It is marked "DATE NOT READABLE – CHECK NOTAM".
- **Obstacle NOTAMs are shown only when they matter for the flight.** An obstacle NOTAM now shows when its text says it affects the heights or gradients of a runway, approach, SID or STAR, for example changed minima, a procedure not authorised, a changed glide path angle, a climb gradient or take-off minimums.
- **An obstacle NOTAM that also changes something else is shown for that reason.** This covers a closed runway, taxiway, apron or stand, changed declared distances, a displaced threshold, a navaid or lighting out of service, a procedure withdrawn, introduced or amended, and amended low-visibility operations.
- **Unclear cases are shown, on the safe side,** for example an obstacle notice near a runway that says obstacle clearance is not affected but not whether the take-off side is.
- **These are now hidden:** an obstacle height near a runway that affects no procedure, obstacle-light outages, men or equipment near a runway with no height, and surface notices that say minima and procedures are unchanged.
- **Every newly shown NOTAM that would have no row on the airport card gets one.** Take-off and climb effects go under SIDs; all others, arrival effects included, go under GENERAL.
- **FlightKeys type headings are never part of a NOTAM's text.** They are kept, as printed, in the airport card's NOTAMS group and mark obstacle items; they do not decide the card group, because the cards keep the app's own NOTAM groups.

---

## FlightKeys

- **The app recognises the format by itself.** You do not choose it.
- **One format per flight.** A package that mixes FlightKeys and NavBlue pages is refused, with a message, and the app stays on the import screen.
- **OFP Alerts.** Warnings found while reading the package are listed under OFP Alerts (see Display). The title is red until you tap the list, then turns normal. A new import starts red again. If the filed NAT track is not in the track message, the alert says to check the oceanic clearance.
- **NAT levels are shown as posted.** A gapped list such as FL360 380 400 is shown in full; a list in steps of 10 is shown as a range such as FL340-400. This also applies to NavBlue flights.

---

## Display

- **OFP Alerts.** On the Preflight card, OFP Alerts are in NOTES, below the airport status rows.
- **OFP Remarks.** The Dispatch contact and any Security message are in the OFP Remarks group, below DDG in NOTES. The group is open when the Dispatch contact is REQUIRED or a security message is present; otherwise it is collapsed. Tap its title to open or close it. The group also holds the fuel (PCF and extra fuel), route and ADHOC penalty remarks.
- **Airport cards.** Each card shows Weather, then NOTAMS, as printed in the briefing, both collapsed. Company Remarks is collapsed too: tap it to open. A departure CAT II/III restriction is inside Company Remarks. The chevron on the airport ID row opens or closes all groups of the card.
- **NAT card.** It shows every direction the OFP publishes, each under its own TMI header, the direction of your flight first. If a direction has no tracks, the card says so; if its tracks cannot be read, it says "Tracks not readable – see OFP Alerts". A filed NAT track that is not in the track message is also warned about on the TMI row of the message it names.
- **Operating date.** If the OFP has no readable flight date, the header shows "Operating date needed" and a pop-up opens, filled with today's UTC date. You enter the operating date; later times past 0000Z fall on the next day, and nothing is dated before the date you entered.
- **Crew rest chips.** One chip per pilot, with the role printed on the OFP and no names. The pilot count (2, 3 or 4) comes from the OFP and can be changed.
- **RAW views.** Hazards are shown RAW per FIR, collapsed. Airports in the briefing without a card are listed in one collapsed group; their NOTAMs are RAW only and are not checked against the flight's times.
- **FIR and Company NOTAMs.** Each FIR block is its own group, "FIR XXXX NOTAMs". Company NOTAMs that belong to a FIR have their own "Company NOTAMs" group right after it.

---

## Saved Flights

- **No crew names and no OFP text are saved with a flight.** Flights saved by earlier versions are cleaned the next time the app starts.
- **RAW views and ETP times are rebuilt from the stored PDF** when you reopen a flight. If the PDF is missing, the RAW groups say "RAW not available – re-import the package".
- **A save that fails now tells you.** The message is "Flight not saved – storage full".

---

## Known Limits

- Volcanic ash advisories are not shown anywhere in the app yet - check the briefing package. RAIM outage remarks are shown on the OFP tab only.
- Obstacle NOTAMs cited in the Takeoff and Landing Report are hidden like other obstacle NOTAMs when they affect no procedure - check the report's NOTAM list.
- NOTAMs printed with the year after the time are flagged "DATE NOT READABLE – CHECK NOTAM" although they are valid.
- Pasted FlightKeys text has no briefing NOTAMs or weather; a warning shows on the Preflight card.
- If the stored PDF is missing, the OFP tab is empty after a reload.
- En-route obstacle NOTAMs (MEA / MOCA) are treated inconsistently.
- The Dispatch contact can show REQUIRED when the OFP only asks you to contact dispatch if you have questions - check the OFP remarks.

---

# PilotBrief 1.9.9-hf6 Release Notes

## What's Changed

- Aircraft data and callsigns now come from one shared, versioned module used by the app and the NOTAM rules (aircraft-profile 1.0.0, NOTAM rules 1.12.0). What you see is unchanged.

---

# PilotBrief 1.9.9-hf5 Release Notes

## What's Changed

- The OFP parser now runs from a separate, versioned module (NavBlue parser 2.0.0). What you see is unchanged.

---

# PilotBrief 1.9.9-hf4 Release Notes

## What's Fixed

- When OUT or OFF is changed past 0000Z, the date moves with it. NOTAM and weather windows for every downline airport use the actual UTC date and time.
- Weather for a next-day arrival is now read for the arrival day.
- NOTAMs not in effect during an airport's evaluation window (ETA ± 60 minutes) are no longer shown; NOTAMs for the arrival day are no longer hidden when landing on the next UTC day.

---

# PilotBrief 1.9.9-hf3 Release Notes

## What's Fixed

**NOTAMs no longer hidden** — NOTAMs scheduled for the arrival day and NOTAMs with an estimated end date are no longer hidden. The NOTAM rules now run from a separate, versioned module (NOTAM ruleset 1.11.0); what you see is otherwise unchanged.

**Settings and Help now show the correct version number.**

---

# PilotBrief 1.9.9-hf2 Release Notes

## What's Fixed

**NOTAMs no longer hidden from airport cards** — NOTAMs issued in earlier years, long-term NOTAMs and permanent (PERM) NOTAMs are no longer hidden from airport cards. When a NOTAM's dates cannot be read, the NOTAM is now shown. Different NOTAMs with similar wording are no longer merged: every NOTAM in effect is shown, and a NOTAM printed twice appears once.

---

# PilotBrief 1.9.9-hf1 Release Notes

## What's Fixed

**Improved flight history behavior on iPad** — When you reload or switch apps on iPad, PilotBrief now remembers which crew's flight you were viewing and takes you back there instead of starting at the top of the list.

**Removed automatic background updates** — PilotBrief no longer checks for new briefing packages in the background. You can now check for updates manually when you need to, without unexpected refreshes during flight planning.

**Fixed NOTAM year parsing** — Corrected the year inference logic so NOTAM validity dates are interpreted correctly, especially for end-of-year briefings.

**Fixed OFP remarks parsing** — Improved parsing of remarks and notes sections to correctly handle multi-line entries and special formatting.

## Technical Details

This hotfix release (1.9.9-hf1) includes four targeted fixes addressing crew experience and data accuracy issues identified after 1.9.9 went live.
