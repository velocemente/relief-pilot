# PilotBrief 1.9.9-hf3 Release Notes

## What's Fixed

**NOTAMs no longer hidden** — NOTAMs scheduled for the arrival day and NOTAMs with an estimated end date are no longer hidden. The NOTAM rules now run from a separate, versioned module (NOTAM ruleset 1.11.0); what you see is otherwise unchanged.

---

# PilotBrief 1.9.9-hf2 Release Notes

## What's Fixed

**NOTAMs no longer hidden from airport cards** — NOTAMs issued in earlier years, long-term NOTAMs and permanent (PERM) NOTAMs are no longer hidden from airport cards. When a NOTAM's dates cannot be read, the NOTAM is now shown. Different NOTAMs with similar wording are no longer merged: every NOTAM in effect is shown, and a NOTAM printed twice appears once.

**Settings and Help now show the correct version number.**

---

# PilotBrief 1.9.9-hf1 Release Notes

## What's Fixed

**Improved flight history behavior on iPad** — When you reload or switch apps on iPad, PilotBrief now remembers which crew's flight you were viewing and takes you back there instead of starting at the top of the list.

**Removed automatic background updates** — PilotBrief no longer checks for new briefing packages in the background. You can now check for updates manually when you need to, without unexpected refreshes during flight planning.

**Fixed NOTAM year parsing** — Corrected the year inference logic so NOTAM validity dates are interpreted correctly, especially for end-of-year briefings.

**Fixed OFP remarks parsing** — Improved parsing of remarks and notes sections to correctly handle multi-line entries and special formatting.

## Technical Details

This hotfix release (1.9.9-hf1) includes four targeted fixes addressing crew experience and data accuracy issues identified after 1.9.9 went live.
