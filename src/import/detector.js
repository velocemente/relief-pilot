'use strict';
// FormatDetector — Layer 2 of the canonical import engine (ADR-004 §2).
//
// Scores a Doc against declared profile signatures and returns the best match.
// Throws if the document is rejected:
//   - best score below THRESHOLD  → format not recognised
//   - two top profiles within AMBIGUITY_BAND of each other → format ambiguous
//
// Return: { profileId, confidence }
//   profileId   — 'atlas-5y' (Navtech/eOFP) or 'atlas-fk' (FlightKeys)
//   confidence  — 0.0–1.0; fraction of pages where the primary signature hit

const THRESHOLD = 0.4; // minimum confidence to accept a profile
const AMBIGUITY_BAND = 0.2; // gap between top two profiles required to avoid rejection

// Each profile declares:
//   id        — returned in the result
//   primary   — regex that must appear on a meaningful fraction of pages
//   secondary — regexes that provide a small additive boost
const PROFILES = [
  {
    id: 'atlas-5y',
    // Navtech company PDF and eOFP: every page carries this in the header.
    // Both Atlas Air ("ATLAS AIR BRIEF") and Polar Air Cargo
    // ("POLAR AIR CARGO WORLDWIDE BRIEF") use this layout; the common
    // distinguishing fragment is "BRIEF PAGE N OF N".
    primary: /\bBRIEF\s+PAGE\s+\d+\s+OF\s+\d+/,
    secondary: [],
  },
  {
    id: 'atlas-fk',
    // FlightKeys: every page carries "Page N of M <uuid>" in the footer.
    // The OFP-section pages additionally carry the FUFI line; the briefing
    // pages only have the Page N of M footer.
    primary: /Page \d+ of \d+ [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    // The cover / title page always contains this phrase.
    secondary: [/OPERATIONAL FLIGHT PLAN/],
  },
];

// Score a profile against a Doc.
// Base = (pages where primary matched) / totalPages.
// Each secondary signature found anywhere in the doc adds a small fraction;
// total secondary boost is capped at 0.1.
function scoreProfile(profile, doc) {
  const totalPages = doc.pages.length;
  if (totalPages === 0) return 0;

  let primaryHits = 0;
  let secondaryHits = 0;

  for (const page of doc.pages) {
    let pageHasPrimary = false;
    for (const line of page.lines) {
      if (profile.primary.test(line.text)) pageHasPrimary = true;
      for (const sec of profile.secondary) {
        if (sec.test(line.text)) secondaryHits++;
      }
    }
    if (pageHasPrimary) primaryHits++;
  }

  const base = primaryHits / totalPages;
  const boost = Math.min((secondaryHits / totalPages) * 0.1, 0.1);
  return Math.min(base + boost, 1.0);
}

function detect(doc) {
  const scores = PROFILES.map(p => ({ profileId: p.id, confidence: scoreProfile(p, doc) }));
  scores.sort((a, b) => b.confidence - a.confidence);

  const best = scores[0];
  const second = scores[1];

  if (best.confidence < THRESHOLD) {
    throw new Error(
      `OFP format not recognised (best score ${best.confidence.toFixed(2)} < threshold ${THRESHOLD})`
    );
  }

  if (second && best.confidence - second.confidence < AMBIGUITY_BAND) {
    throw new Error(
      `OFP format ambiguous (${best.profileId} ${best.confidence.toFixed(2)}, ` +
      `${second.profileId} ${second.confidence.toFixed(2)})`
    );
  }

  return { profileId: best.profileId, confidence: best.confidence };
}

module.exports = { detect, THRESHOLD, AMBIGUITY_BAND, _scoreProfile: scoreProfile };
