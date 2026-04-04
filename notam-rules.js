/**
 * notam-rules.js — NOTAM Interpretation Ruleset  (updated v1.9.0-dev-r2)
 * ───────────────────────────────────────────────
 * Standalone, import-friendly module for parsing and interpreting
 * NOTAMs per FAA and ICAO standards.
 *
 * Sources:
 *   FAA AIP GEN 3.1  — Aeronautical Information Services (NOTAM structure §5)
 *   FAA AIP GEN 2.2  — Abbreviations used in AIS publications
 *   ICAO Doc 4444    — PANS-ATM; NOTAM format, Q-line, Item codes
 *
 * Usage (ES module):
 *   import { parseNotam, classifyNotam, isNotamActive,
 *            interpretQCode, decodeNotamSchedule,
 *            convertUtcToLocal } from './notam-rules.js';
 *
 * Usage (CommonJS):
 *   const notam = require('./notam-rules.js');
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// § 1 · NOTAM CLASSIFICATION SYSTEM
//       Source: FAA AIP GEN 3.1 §5
// ═══════════════════════════════════════════════════════════════

/**
 * NOTAM classification types per FAA AIP GEN 3.1 §5.1.
 */
const NOTAM_CLASSES = {
  A: {
    label:       'International NOTAM',
    description: 'Full information on airports, facilities, and flight procedures for international civil aviation.',
    prefix:      'A',
    serialFormat:'A####/YY ICAO', // e.g. A0001/84 KJFK
  },
  B: {
    label:       'International Airspace NOTAM',
    description: 'Short-term info on potentially hazardous international/domestic airspace of concern to international flights.',
    prefix:      'A', // still uses "A" series letter
    identifier:  'ARTCC/FIR ICAO code',
  },
  C: {
    label:       'Permanent Airspace NOTAM',
    description: 'Permanent changes to en route airway structure and aeronautical services of a general nature.',
    prefix:      'A',
    identifier:  'KFDC',
  },
  E: {
    label:       'Domestic NOTAM',
    description: 'Information of concern to aircraft other than international civil aviation. Local/national distribution only.',
    prefix:      'see ENR 1.10',
  },
};

/**
 * NOTAM action types per FAA AIP GEN 3.1 §5.2.
 */
const NOTAM_ACTIONS = {
  NOTAMN: { label: 'New',       description: 'NOTAM containing new information.' },
  NOTAMC: { label: 'Cancel',    description: 'NOTAM cancelling a previous NOTAM.' },
  NOTAMR: { label: 'Replace',   description: 'NOTAM replacing a previous NOTAM.' },
};

// ═══════════════════════════════════════════════════════════════
// § 2 · ICAO NOTAM FORMAT (Doc 4444 Appendix 6)
//       The international NOTAM uses a structured 7-item format
// ═══════════════════════════════════════════════════════════════

/**
 * ICAO NOTAM items per Doc 4444 / standard international format.
 */
const NOTAM_ITEMS = {
  Q:    'Q-line — routing/classification code (Subject/Condition)',
  A:    'Location indicator(s) — ICAO 4-letter code(s)',
  B:    'Effective from — DDHHMMz',
  C:    'Effective to — DDHHMMz or PERM',
  D:    'Schedule (if not continuous) — day/time of activity',
  E:    'NOTAM text — plain language description',
  F:    'Lower limit — altitude or GND/SFC',
  G:    'Upper limit — altitude or UNL (unlimited)',
};

/**
 * Q-line structure: Q) FIR/QCODE/TRAFFIC/PURPOSE/SCOPE/LOWER/UPPER/COORDINATES
 * Source: ICAO Doc 4444 Appendix 6
 */
const QCODE_STRUCTURE = {
  fields: ['FIR', 'QCODE', 'TRAFFIC', 'PURPOSE', 'SCOPE', 'LOWER', 'UPPER', 'COORDINATES'],
  trafficCodes: {
    I:  'IFR',
    V:  'VFR',
    IV: 'IFR and VFR (both)',
    K:  'NOTAM checklist',
  },
  purposeCodes: {
    N:  'NOTAM selected for immediate attention (PIB entry)',
    B:  'Trigger NOTAM — AIRAC',
    O:  'Flight operations',
    M:  'Miscellaneous',
    K:  'Checklist',
  },
  scopeCodes: {
    A:  'Aerodrome',
    E:  'En route',
    W:  'Nav warning area',
    AE: 'Aerodrome and en route',
    AW: 'Aerodrome and nav warning',
    EW: 'En route and nav warning',
    AEW:'Aerodrome, en route, and nav warning',
  },
};

// ═══════════════════════════════════════════════════════════════
// § 3 · Q-CODE SUBJECT / CONDITION DECODE TABLE
//       Source: ICAO Doc 4444 App 6 Table A6-1
// ═══════════════════════════════════════════════════════════════

/**
 * ICAO Q-code subject (2nd & 3rd characters after the Q prefix).
 * Format: QXX where XX = subject + condition.
 * This table covers the most operationally significant codes.
 */
const QCODE_SUBJECTS = {
  // Airspace / Airspace Restrictions
  'AR': 'Airspace — Restricted area',
  'AC': 'Airspace — Class change',
  'AD': 'Airspace — Air defense identification zone',
  'AX': 'Airspace — Change in airspace classification',
  'CA': 'Airspace — Controlled airspace',
  // Communication
  'CP': 'Communications — ATIS',
  'CT': 'Communications — Terminal information service',
  'CG': 'Communications — Ground/surface movement control',
  'CR': 'Communications — Radio',
  // Lighting
  'LA': 'Lighting — Approach lights',
  'LB': 'Lighting — Aerodrome beacon',
  'LC': 'Lighting — Runway centerline lights',
  'LE': 'Lighting — Runway edge lights',
  'LF': 'Lighting — Runway end identifier lights (REIL)',
  'LH': 'Lighting — High intensity runway lights',
  'LI': 'Lighting — Runway lights (general)',
  'LL': 'Lighting — Low intensity runway lights',
  'LP': 'Lighting — PAPI/VASI',
  'LT': 'Lighting — Threshold lights',
  'LV': 'Lighting — Visual approach slope indicator',
  'LX': 'Lighting — Taxiway centerline lights',
  // Navigation Aids
  'NA': 'NAVAID — All radio navaids',
  'NB': 'NAVAID — NDB/Locator',
  'ND': 'NAVAID — DME',
  'NG': 'NAVAID — Glide slope/path',
  'NI': 'NAVAID — ILS (complete)',
  'NL': 'NAVAID — Localizer',
  'NM': 'NAVAID — Marker beacon',
  'NO': 'NAVAID — VOR',
  'NT': 'NAVAID — TACAN',
  'NV': 'NAVAID — VORTAC',
  // Runway
  'RA': 'Runway — All',
  'RB': 'Runway — Braking action',
  'RC': 'Runway — Closed',
  'RD': 'Runway — Declared distances changed',
  'RE': 'Runway — Arresting system',
  'RF': 'Runway — Friction measurement',
  'RH': 'Runway — Threshold displaced',
  'RL': 'Runway — Load bearing capacity',
  'RM': 'Runway — Markings',
  'RO': 'Runway — Operations',
  'RS': 'Runway — Surface',
  'RT': 'Runway — Temporarily closed',
  'RU': 'Runway — Usability',
  // Services
  'SA': 'Services — ATC',
  'SC': 'Services — Customs',
  'SE': 'Services — ATC surveillance',
  'SF': 'Services — Flying club',
  'SL': 'Services — Snow/ice plan',
  'SO': 'Services — ARFF (Aircraft Rescue and Fire Fighting)',
  'SP': 'Services — Approach control',
  'SU': 'Services — Unserviceable',
  // Taxiway
  'TA': 'Taxiway — All',
  'TC': 'Taxiway — Closed',
  'TH': 'Taxiway — Hard surface',
  'TL': 'Taxiway — Lighting',
  'TM': 'Taxiway — Markings',
  'TW': 'Taxiway — Work in progress',
  // Obstacles
  'OA': 'Obstacle — New',
  'OB': 'Obstacle — Unlit',
  'OC': 'Obstacle — Crane',
  'OE': 'Obstacle — Building',
  'OF': 'Obstacle — Objects on RWY or TWY',
  'OH': 'Obstacle — Height change',
  'OL': 'Obstacle — Lights',
  'OW': 'Obstacle — Wind turbine',
  // Movement area (Apron / Apron lights etc.)
  'MA': 'Movement area — Apron',
  'MC': 'Movement area — Checkpoint',
  'MD': 'Movement area — Declared distances',
  // Procedures
  'PA': 'Procedure — Instrument approach',
  'PB': 'Procedure — Departure',
  'PC': 'Procedure — CVFR',
  'PD': 'Procedure — SID',
  'PE': 'Procedure — STAR',
  'PF': 'Procedure — Instrument flight',
  'PH': 'Procedure — Holding',
  'PO': 'Procedure — Obstacle clearance altitude',
  'PP': 'Procedure — Non-directional beacon approach',
  'PR': 'Procedure — Radio',
  'PU': 'Procedure — Missed approach',
  'PX': 'Procedure — RNAV/RNP',
  // Warnings
  'WA': 'Warning — Air display',
  'WB': 'Warning — Balloon flight',
  'WC': 'Warning — Captive balloon/kite',
  'WD': 'Warning — Demolition of explosives',
  'WE': 'Warning — Exercises',
  'WF': 'Warning — Air refueling',
  'WG': 'Warning — Glider flying',
  'WJ': 'Warning — Banner/target towing',
  'WL': 'Warning — Laser lights',
  'WM': 'Warning — Military exercises',
  'WP': 'Warning — Parachute jumping/sport',
  'WR': 'Warning — Restricted area',
  'WS': 'Warning — Supersonic flight',
  'WT': 'Warning — Toxic/radioactive',
  'WU': 'Warning — Unmanned aircraft',
  'WV': 'Warning — Formation flight',
  'WW': 'Warning — Significant met',
  'WX': 'Warning — SIGMET / met hazard',
  'WZ': 'Warning — Volcanic eruption',
};

/**
 * Condition suffixes (4th/5th Q-code character).
 * Source: ICAO Doc 4444 App 6 Table A6-1
 */
const QCODE_CONDITIONS = {
  A:  'Available / Activated',
  C:  'Closed',
  D:  'Danger',
  I:  'Inoperative / Unserviceable',
  L:  'Limitation',
  N:  'New',
  O:  'Operational',
  P:  'Prohibited',
  R:  'Restricted',
  S:  'Suspended',
  T:  'Test / Temporary',
  U:  'Unserviceable',
  X:  'Cancelled',
};

/**
 * Decode a Q-code string into human-readable subject + condition.
 * @param {string} qcode - e.g. 'QRTCA' or 'QRC' or 'MNLC'
 * @returns {{ subject: string|null, condition: string|null, description: string }}
 */
function interpretQCode(qcode) {
  if (!qcode) return { subject: null, condition: null, description: 'No Q-code provided' };

  // Strip leading Q if present
  const code = qcode.toUpperCase().replace(/^Q/, '');

  // Subject = first 2 chars, condition = last char(s)
  const subject   = code.slice(0, 2);
  const condition = code.slice(2);

  const subjectDesc   = QCODE_SUBJECTS[subject]   || `Unknown subject code: ${subject}`;
  const conditionDesc = QCODE_CONDITIONS[condition] || (condition ? `Unknown condition: ${condition}` : '');

  return {
    subject:     subject,
    condition:   condition || null,
    description: condition ? `${subjectDesc} — ${conditionDesc}` : subjectDesc,
    subjectFull: subjectDesc,
    conditionFull: conditionDesc,
  };
}

// ═══════════════════════════════════════════════════════════════
// § 4 · NOTAM PARSER
//       Source: ICAO Doc 4444 App 6; FAA AIP GEN 3.1 §5
// ═══════════════════════════════════════════════════════════════

/**
 * Parse a raw NOTAM string (ICAO format) into a structured object.
 *
 * Expected format (single NOTAM):
 *   A1234/26 NOTAMN
 *   Q) KZAB/QRTCA/IV/NBO/W/000/100/3400N11200W005
 *   A) KDFW
 *   B) 2603131400
 *   C) 2603132200
 *   E) RWY 17C/35C CLSD DUE TO CONST WIP
 *   F) SFC G) 2500FT MSL
 *
 * @param {string} raw - Raw NOTAM text
 * @returns {object} Parsed NOTAM
 */
function parseNotam(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Invalid NOTAM input');

  const result = {
    raw,
    number:      null,    // e.g. A1234/26
    action:      null,    // NOTAMN | NOTAMC | NOTAMR
    replaces:    null,    // for NOTAMR — the NOTAM it replaces
    cancels:     null,    // for NOTAMC — the NOTAM it cancels
    // Q-line fields
    fir:         null,
    qCode:       null,
    qDecoded:    null,
    traffic:     null,
    purpose:     null,
    scope:       null,
    lowerLimit:  null,
    upperLimit:  null,
    coordinates: null,
    // Items
    location:    null,    // Item A
    effectiveFrom: null,  // Item B — UTC DDHHMMz or 10-digit YYMMDDHHmm
    effectiveTo:   null,  // Item C — UTC or PERM
    schedule:      null,  // Item D
    text:          null,  // Item E — plain language
    lowerAlt:      null,  // Item F
    upperAlt:      null,  // Item G
    // Derived
    isActive:    null,
    classification: null,
    keywords:    [],
    operationalImpact: null,
  };

  const text = raw.trim();

  // Number and action (first line)
  const headerRe = /^([A-Z]\d{4}\/\d{2})\s+(NOTAM[NCR])/m;
  const headerM  = text.match(headerRe);
  if (headerM) {
    result.number = headerM[1];
    result.action = headerM[2];
    if (result.action === 'NOTAMC') {
      const cancelRe = /CANCELS?\s+([A-Z]\d{4}\/\d{2})/i;
      const cancelM  = text.match(cancelRe);
      if (cancelM) result.cancels = cancelM[1];
    }
    if (result.action === 'NOTAMR') {
      const replRe = /REPLACES?\s+([A-Z]\d{4}\/\d{2})/i;
      const replM  = text.match(replRe);
      if (replM) result.replaces = replM[1];
    }
  }

  // Q-line
  const qLineRe = /Q\)\s*([A-Z]{4})\/([A-Z0-9]+)\/([IV]{1,2}|K)\/([NOBMK]+)\/([AEW]{1,3})\/(\d{3})\/(\d{3}|UNL)\/(.+?)(?:\n|$)/i;
  const qM = text.match(qLineRe);
  if (qM) {
    result.fir         = qM[1];
    result.qCode       = qM[2];
    result.qDecoded    = interpretQCode(qM[2]);
    result.traffic     = qM[3];
    result.purpose     = qM[4];
    result.scope       = qM[5];
    result.lowerLimit  = parseInt(qM[6], 10) * 100; // FL → ft
    result.upperLimit  = qM[7] === 'UNL' ? 'UNLIMITED' : parseInt(qM[7], 10) * 100;
    result.coordinates = qM[8].trim();
  }

  // Item A — Location(s)
  const aM = text.match(/A\)\s*([A-Z0-9\s]+?)(?=\s*B\))/);
  if (aM) result.location = aM[1].trim();

  // Item B — Effective from
  const bM = text.match(/B\)\s*(\d{10}|\d{6}Z?)/);
  if (bM) result.effectiveFrom = parseNotamTime(bM[1]);

  // Item C — Effective to (or PERM)
  const cM = text.match(/C\)\s*(PERM|\d{10}|\d{6}Z?)/);
  if (cM) result.effectiveTo = cM[1] === 'PERM' ? { perm: true } : parseNotamTime(cM[1]);

  // Item D — Schedule (optional)
  const dM = text.match(/D\)\s*(.+?)(?=\s*E\))/s);
  if (dM) result.schedule = dM[1].trim();

  // Item E — Plain language text
  const eM = text.match(/E\)\s*(.+?)(?=\s*(?:F\)|G\)|$))/s);
  if (eM) result.text = eM[1].replace(/\s+/g, ' ').trim();

  // Item F — Lower limit
  const fM = text.match(/F\)\s*(.+?)(?=\s*G\)|\s*$)/);
  if (fM) result.lowerAlt = fM[1].trim();

  // Item G — Upper limit
  const gM = text.match(/G\)\s*(.+?)(?=\s*$)/);
  if (gM) result.upperAlt = gM[1].trim();

  // Derive classification
  result.classification = classifyNotam(result);

  // Extract keywords from text for operational impact
  if (result.text) {
    result.keywords        = extractNotamKeywords(result.text);
    result.operationalImpact = deriveOperationalImpact(result);
  }

  // Active status (based on current UTC time)
  result.isActive = isNotamActive(result);

  return result;
}

/**
 * Parse a NOTAM time field.
 * Formats: YYMMDDHHmm (10-digit), DDHHMMz (6+Z), DDHHMM (6)
 * @param {string} t
 * @returns {object}
 */
function parseNotamTime(t) {
  if (!t) return null;
  const s = t.toUpperCase().replace('Z','');
  if (s.length === 10) {
    return {
      raw:    t,
      year:   parseInt('20' + s.slice(0,2), 10),
      month:  parseInt(s.slice(2,4), 10),
      day:    parseInt(s.slice(4,6), 10),
      hourZ:  parseInt(s.slice(6,8), 10),
      minZ:   parseInt(s.slice(8,10), 10),
      utcStr: `${s.slice(4,6)}/${s.slice(6,8)}:${s.slice(8,10)}Z`,
    };
  }
  if (s.length === 6) {
    return {
      raw:   t,
      day:   parseInt(s.slice(0,2), 10),
      hourZ: parseInt(s.slice(2,4), 10),
      minZ:  parseInt(s.slice(4,6), 10),
      utcStr:`${s.slice(0,2)} at ${s.slice(2,4)}:${s.slice(4,6)}Z`,
    };
  }
  return { raw: t };
}

// ═══════════════════════════════════════════════════════════════
// § 5 · NOTAM CLASSIFICATION & OPERATIONAL IMPACT
//       Source: FAA operational practice; ICAO Doc 4444
// ═══════════════════════════════════════════════════════════════

/**
 * Classify a NOTAM by operational priority.
 * @param {object} notam - Parsed NOTAM
 * @returns {{ priority: number, category: string, label: string }}
 */
function classifyNotam(notam) {
  const q   = notam.qCode || '';
  const txt = (notam.text || '').toUpperCase();

  // Extract the 2-character subject code from the Q-code string (e.g. 'QNII' → 'NI').
  // The full qCode stored by parseNotam is the raw string after 'Q/' in the Q-line,
  // e.g. 'QRTCA', 'QNII', 'QNGI'. Subject = chars 1-2 (0-indexed), condition = char 3+.
  const qSub = q.length >= 3 ? q.slice(1, 3).toUpperCase() : '';

  const US_PAT = /\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL)\b/;

  // ── P1 — Safety-critical: runway/airport closure, ILS precision guidance ──

  if (/RC|RT|RU/.test(qSub) || (txt.includes('RWY') && txt.includes('CLSD'))) {
    return { priority: 1, category: 'RUNWAY', label: 'Runway / Movement Area — P1 CRITICAL' };
  }
  if (txt.includes('ARPT CLSD') || txt.includes('AD CLSD')) {
    return { priority: 1, category: 'AIRPORT', label: 'Airport Closure — P1 CRITICAL' };
  }
  // Q-code: NI=ILS complete, NL=localizer, NG=glide slope
  if (/^(?:NI|NL|NG)$/.test(qSub)) {
    return { priority: 1, category: 'NAVAID_ILS', label: 'ILS / Localizer / Glide Slope — P1 CRITICAL' };
  }
  // Text fallback: ILS/LOC/GS unserviceable when no Q-code
  if (US_PAT.test(txt) && /\b(?:ILS|LOC|LOCALIZ(?:ER|OR)|GLIDE\s+(?:SLOPE|PATH)|GLIDESLOPE|G\/S|G\/P)\b/.test(txt)) {
    return { priority: 1, category: 'NAVAID_ILS', label: 'ILS / Localizer / Glide Slope — P1 CRITICAL' };
  }

  // ── P2 — High: other NAVAIDs, GPS/GNSS, DME, approach procedures, approach lighting ──

  // Q-codes: NA=all navaids, NB=NDB, ND=DME, NO=VOR, NT=TACAN, NV=VORTAC
  if (/^(?:NA|NB|ND|NO|NT|NV)$/.test(qSub)) {
    return { priority: 2, category: 'NAVAID', label: 'NAVAID Unserviceable — P2 HIGH' };
  }
  // Q-code: NM=marker beacon — check before generic NAVAID text fallback
  if (/^NM$/.test(qSub)) {
    return { priority: 2, category: 'NAVAID_MARKER', label: 'Marker Beacon Unserviceable — P2 HIGH' };
  }
  // GPS/GNSS unserviceable — check before generic VOR/NDB fallback
  if (/\b(?:GPS|GNSS|SATNAV)\b/.test(txt) &&
      /\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNRELIABLE|UNREL|DEGRADED|JAMMING)\b/.test(txt)) {
    return { priority: 2, category: 'NAVAID_GPS', label: 'GPS/GNSS Unserviceable — P2 HIGH' };
  }
  // RAIM not available
  if (/\bRAIM\b/.test(txt) && /\b(?:NOT\s+AVBL|NOT\s+AVAILABLE|UNAVBL|OUTAGE)\b/.test(txt)) {
    return { priority: 2, category: 'NAVAID_GPS', label: 'RAIM Not Available — P2 HIGH' };
  }
  // Text fallback: VOR/NDB/DME/TACAN/VORTAC unserviceable
  // NOTE: LOM/LMM are compass locator navaids — check for marker-specific terms first
  if (US_PAT.test(txt) && /\b(?:OUTER\s+MARKER|MIDDLE\s+MARKER|INNER\s+MARKER|LOM\b|LMM\b|OM\b|MM\b|IM\b)\b/.test(txt)) {
    return { priority: 2, category: 'NAVAID_MARKER', label: 'Marker Beacon Unserviceable — P2 HIGH' };
  }
  if (US_PAT.test(txt) && /\b(?:VOR|NDB|DME|TACAN|VORTAC|LOCAT(?:OR|ER))\b/.test(txt)) {
    return { priority: 2, category: 'NAVAID', label: 'NAVAID Unserviceable — P2 HIGH' };
  }
  // Procedure changes: PA=instrument approach, PD=SID, PE=STAR, PX=RNAV/RNP, PU=missed approach
  if (/^(?:PA|PD|PE|PX|PU)$/.test(qSub)) {
    return { priority: 2, category: 'PROCEDURE', label: 'Approach / Departure Procedure — P2 HIGH' };
  }
  // Text fallback for procedure changes
  if (/\b(?:IAP|APCH\s+PROC|APPROACH\s+PROC|INSTRUMENT\s+APCH|SID|STAR)\b/.test(txt) &&
      /\b(?:AMDT|CHANGE|REVISED|SUSPENDED|NOT\s+AUTH|PROC\s+NA)\b/.test(txt)) {
    return { priority: 2, category: 'PROCEDURE', label: 'Approach / Departure Procedure — P2 HIGH' };
  }
  // Approach lighting Q-codes: LA=approach lights, LP=PAPI/VASI, LV=VASI
  if (/^(?:LA|LP|LV)$/.test(qSub)) {
    return { priority: 2, category: 'LIGHTING_APPROACH', label: 'Approach Lighting / PAPI — P2 HIGH' };
  }
  // Text fallback: ALS/ALSF/MALSR/SSALR/PAPI/VASI/REIL unserviceable
  if (US_PAT.test(txt) && /\b(?:ALS[FR]?|ALSF|MALSR?|SSALR?|SSALF|ODALS|RAIL|PAPI|VASI|REIL|APPROACH\s+LIGHT)\b/.test(txt)) {
    return { priority: 2, category: 'LIGHTING_APPROACH', label: 'Approach Lighting / PAPI — P2 HIGH' };
  }

  // ── P3 — Moderate: runway lighting, taxiways, thresholds, obstacles, warnings ──

  // Runway centerline / TDZ lights Q-codes: LC=centerline, LT=threshold
  if (/^(?:LC|LT)$/.test(qSub)) {
    return { priority: 3, category: 'LIGHTING_CATII', label: 'Cat II/III Lighting — P3 MODERATE' };
  }
  if (US_PAT.test(txt) && /\b(?:RCLL?|RCLM|RUNWAY\s+(?:CENTERLINE|CENTRE\s+LINE)|TDZ|TDZL?|TOUCHDOWN\s+ZONE)\b/.test(txt)) {
    return { priority: 3, category: 'LIGHTING_CATII', label: 'Cat II/III Lighting — P3 MODERATE' };
  }
  // Other runway lighting Q-codes
  if (/^L[BCEFHILX]$/.test(qSub)) {
    return { priority: 3, category: 'LIGHTING', label: 'Runway/Aerodrome Lighting — P3 MODERATE' };
  }
  if (US_PAT.test(txt) && /\b(?:HIRL|MIRL|LIRL|HIL|MIL|RUNWAY\s+EDGE\s+LIGHTS?|RUNWAY\s+LIGHTS?)\b/.test(txt)) {
    return { priority: 3, category: 'LIGHTING', label: 'Runway/Aerodrome Lighting — P3 MODERATE' };
  }
  // Displaced threshold (Q-code RH = runway threshold displaced)
  if (/^RH$/.test(qSub) ||
      /\b(?:DSPLCD?|DISPLACED?)\s+(?:THR|THLD?|THRESHOLD)\b/.test(txt) ||
      /\bTHRESHOLD\b.*\bDISPLACED?\b/.test(txt)) {
    return { priority: 3, category: 'THRESHOLD', label: 'Threshold Displacement — P3 MODERATE' };
  }
  // Taxiway
  if (/^(?:TA|TC)$/.test(qSub) || (txt.includes('TWY') && txt.includes('CLSD'))) {
    return { priority: 3, category: 'TAXIWAY', label: 'Taxiway — P3 MODERATE' };
  }
  // Obstacle
  if (/^(?:OA|OB|OC|OE|OH|OW)$/.test(qSub)) {
    return { priority: 3, category: 'OBSTACLE', label: 'Obstacle — P3 MODERATE' };
  }
  // Warning
  if (/^W[A-Z]$/.test(qSub)) {
    return { priority: 3, category: 'WARNING', label: 'Airspace Warning — P3 MODERATE' };
  }

  // ── P4 — Administrative, informational ──
  return { priority: 4, category: 'INFO', label: 'Informational — P4 LOW' };
}

/**
 * Known keywords and their operational significance.
 * @param {string} text - NOTAM Item E text
 * @returns {string[]} Keywords found
 */
function extractNotamKeywords(text) {
  const upper = text.toUpperCase();
  const keywords = [];

  const KEYWORD_MAP = [
    // Closures / unserviceability
    'CLSD', 'CLOSED', 'UNAVBL', 'UNSERVICEABLE', 'INOP', 'OTS', 'U/S', 'NOT AVBL',
    // Construction / hazards
    'WIP', 'CONST', 'CRANE', 'OBSTN', 'OBSTACLE',
    // Precision approach: ILS components
    'ILS', 'LOC', 'LOCALIZER', 'GS', 'G/S', 'G/P', 'GLIDE SLOPE', 'GLIDE PATH',
    // Approach types
    'APCH', 'PROC', 'IAP', 'LPV', 'LNAV', 'RNAV', 'RNP', 'VOR', 'NDB', 'LDA', 'GLS', 'GBAS',
    // Departure
    'SID', 'STAR',
    // Marker beacons
    'OM', 'MM', 'IM', 'LOM', 'LMM', 'OUTER MARKER', 'MIDDLE MARKER', 'INNER MARKER',
    // DME / ranging
    'DME', 'TACAN', 'VORTAC',
    // GPS / GNSS / RAIM
    'GPS', 'GNSS', 'SATNAV', 'RAIM', 'WAAS', 'SBAS',
    // Runway / movement area
    'RWY', 'TWY', 'THRESHOLD', 'DSPLCD', 'DISPLACED',
    // Approach lighting
    'ALS', 'ALSF', 'MALSR', 'MALSF', 'SSALR', 'SSALF', 'SSALS', 'ODALS', 'RAIL',
    // Visual aids
    'PAPI', 'VASI', 'PVASI', 'APAPI', 'REIL',
    // Runway edge / centerline / TDZ lighting
    'HIRL', 'MIRL', 'LIRL', 'RCLL', 'RCLM', 'TDZ', 'TDZL',
    // Services
    'ATC', 'ATIS', 'ARFF', 'FSS',
    // Alteration
    'SHORTENED', 'REDUCED', 'CHANGED', 'RAISED', 'INCREASED',
    // Military/restricted
    'RESTRICTED', 'PROHIBITED', 'TFR', 'MOA', 'LASER',
    // Approach minimums
    'MDA', 'MDH', 'DA', 'DH', 'CAT I', 'CAT II', 'CAT III',
    // Alternate / missed approach
    'ALTN MINS', 'ALTERNATE MINIMUMS', 'MISSED APCH', 'ALTN MA',
  ];

  for (const kw of KEYWORD_MAP) {
    if (upper.includes(kw)) keywords.push(kw);
  }

  return [...new Set(keywords)];
}

/**
 * Derive a brief operational impact statement from a parsed NOTAM.
 * @param {object} notam
 * @returns {string}
 */
function deriveOperationalImpact(notam) {
  const txt = (notam.text || '').toUpperCase();
  const cat = notam.classification?.category || '';

  if (cat === 'RUNWAY') {
    const rwy = txt.match(/RWY\s+([\dLCR\/]+)/);
    return `Runway ${rwy ? rwy[1] : 'affected'} — verify alternate runway availability and approach procedures.`;
  }
  if (cat === 'AIRPORT') {
    return 'Airport closed — coordinate alternate destination with dispatch.';
  }
  if (cat === 'NAVAID_ILS') {
    // Distinguish GS-only vs full ILS vs LOC-only from text
    if (/\b(?:GLIDE\s+(?:SLOPE|PATH)|G\/S|G\/P|GS\b)\b/.test(txt) &&
        !/\bILS\b.*\b(?:U\/S|UNSERVICEABLE|OTS|INOP)\b/.test(txt)) {
      return 'Glide slope unserviceable — ILS approach degrades to LOC-only. Expect non-precision minima. Verify Cat II/III availability.';
    }
    if (/\bLOCALIZ(?:ER|OR)\b|\bLOC\b/.test(txt) &&
        !/\bILS\b.*\b(?:U\/S|UNSERVICEABLE|OTS|INOP)\b/.test(txt)) {
      return 'Localizer unserviceable — ILS/LOC approach not available. Expect RNAV, VOR, or circling approach if available.';
    }
    return 'ILS/Localizer or Glide Slope unserviceable — expect non-precision or circling approach. Verify alternate minimums and Cat II/III applicability.';
  }
  if (cat === 'NAVAID_GPS') {
    if (/\bRAIM\b/.test(txt)) {
      return 'RAIM not available — RNP/RNAV approaches requiring RAIM are not authorized. Verify alternate approach type.';
    }
    if (/\b(?:UNRELIABLE|UNREL|DEGRADED)\b/.test(txt)) {
      return 'GPS/GNSS unreliable — RNAV/RNP approach accuracy degraded. Verify RAIM prediction and consider non-RNAV backup.';
    }
    return 'GPS/GNSS unserviceable — all RNAV/RNP/LPV/LNAV approaches not available. Use ILS, VOR, or NDB approach if available.';
  }
  if (cat === 'NAVAID_MARKER') {
    return 'Marker beacon unserviceable — DA/MDA audio cue unavailable. Cross-check with DME or alt distance source on ILS.';
  }
  if (cat === 'NAVAID') {
    return 'NAVAID unserviceable — use alternate navigation. Verify route/approach viability and applicable NOTAMs for backup procedures.';
  }
  if (cat === 'PROCEDURE') {
    return 'Approach or departure procedure changed — published charts may not reflect current procedure. Obtain current IAP before flight.';
  }
  if (cat === 'LIGHTING_APPROACH') {
    // ALS type affects the magnitude of minima increase
    if (/\b(?:ALSF|MALSR|SSALR|SSALF)\b/.test(txt)) {
      return 'Primary approach lighting (ALSF/MALSR/SSALR) unserviceable — published MDA/DA increases significantly. Check current IAP for revised minima.';
    }
    if (/\b(?:PAPI|VASI|PVASI|APAPI)\b/.test(txt)) {
      return 'PAPI/VASI unserviceable — visual glide path reference unavailable. Use published instrument glide path or VGSI substitute if available.';
    }
    if (/\bREIL\b/.test(txt)) {
      return 'REIL unserviceable — runway end identification lights out. May increase approach difficulty in low-visibility conditions.';
    }
    return 'Approach lighting degraded — published MDA/DA may be higher than current IAP. Verify current minima before commencing approach.';
  }
  if (cat === 'LIGHTING_CATII') {
    if (/\b(?:RCLL?|RCLM|RUNWAY\s+CENTERLINE)\b/.test(txt)) {
      return 'Runway centerline lights unserviceable — Cat II/III operations and low-visibility taxi may not be authorized. Verify with dispatch and applicable ops specs.';
    }
    if (/\b(?:TDZ|TDZL?|TOUCHDOWN\s+ZONE)\b/.test(txt)) {
      return 'Touchdown zone lights unserviceable — Cat II/III operations not authorized. Expect Cat I minima or higher.';
    }
    return 'Cat II/III runway lighting unserviceable — precision approach operations may be restricted. Verify applicable ops specs.';
  }
  if (cat === 'LIGHTING') {
    return 'Runway edge lighting degraded — assess capability for night/low-visibility operations. Verify applicable RVR minimums.';
  }
  if (cat === 'THRESHOLD') {
    const rwy = txt.match(/RWY\s+([\dLCR\/]+)/);
    return `Threshold displaced on RWY ${rwy ? rwy[1] : 'affected'} — landing distance available (LDA) is reduced. Verify published LDA and approach minima.`;
  }
  if (cat === 'TAXIWAY') {
    return 'Taxiway affected — review airport diagram for alternate routing. Check for wingspan restrictions applicable to B747.';
  }
  if (cat === 'OBSTACLE') {
    return 'New or changed obstacle — verify obstacle clearance on departure/approach. Check applicable ODP or SID climb gradient.';
  }
  if (cat === 'WARNING') {
    return 'Airspace restriction or warning active — check applicability to planned route and time of flight.';
  }
  return 'Review NOTAM for operational relevance to planned flight.';
}

// ═══════════════════════════════════════════════════════════════
// § 6 · NOTAM ACTIVE STATUS CHECK
// ═══════════════════════════════════════════════════════════════

/**
 * Determine if a NOTAM is currently active (UTC now).
 * Handles PERM NOTAMs, and the optional D-item schedule.
 *
 * @param {object} notam - Parsed NOTAM
 * @param {Date}   [now] - Optional UTC reference time (default: now)
 * @returns {boolean|null} true=active, false=not active, null=cannot determine
 */
function isNotamActive(notam, now = new Date()) {
  if (!notam.effectiveFrom) return null;

  const fromTime = notamTimeToDate(notam.effectiveFrom);
  if (!fromTime) return null;

  if (now < fromTime) return false; // Not yet effective

  // PERM NOTAMs never expire
  if (notam.effectiveTo?.perm) return true;

  const toTime = notamTimeToDate(notam.effectiveTo);
  if (!toTime) return null;

  if (now > toTime) return false; // Expired

  // Check D-item schedule if present
  if (notam.schedule) {
    return isActiveInSchedule(notam.schedule, now);
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
// § 6a · STANDALONE UTC WINDOW HELPERS
//        Mirror of index.html xNW / nwOverlap — works without
//        window globals so notam-rules.js is usable in Node and
//        in evalNotams when called from the app.
//
//        Atlas Air OFP NOTAMs embed effectivity inline as one of:
//          (a) DDMMMHHmm–DDMMMHHmm  e.g. 01APR0001-30APR2359
//          (b) YYMMDDHHmm–YYMMDDHHmm (10-digit ICAO)
//          (c) WEF DDMMMHHmm UFC DDMMMHHmm
//          (d) EFFECTIVE DDMMMHHmm UNTIL DDMMMHHmm
//        All four formats are handled here.
// ═══════════════════════════════════════════════════════════════

const _SMON = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};

/**
 * Parse a single NOTAM date token to UTC milliseconds.
 * Accepts:
 *   DDMMMHHmm  — day/month-abbr/hhmm, year inferred from baseYear / forced by forceYear
 *   YYMMDDHHmm — 10-digit ICAO format
 * @param {string} token
 * @param {number} baseYear  — flight year (for DDMMMHHmm)
 * @param {number} forceYear — explicit year override (for cross-year NOTAM windows)
 * @returns {number|null} UTC ms, or null on failure
 */
function _parseDateToken(token, baseYear, forceYear) {
  const t = token.trim().toUpperCase();

  // 10-digit ICAO: YYMMDDHHmm
  if (/^\d{10}$/.test(t)) {
    const yr = parseInt('20' + t.slice(0, 2));
    const mo = parseInt(t.slice(2, 4)) - 1;
    const dd = parseInt(t.slice(4, 6));
    const hh = parseInt(t.slice(6, 8));
    const mi = parseInt(t.slice(8, 10));
    return Date.UTC(yr, mo, dd, hh, mi);
  }

  // DDMMMHHmm (9 chars): e.g. 01APR0001
  const m9 = t.match(/^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{4})$/);
  if (m9) {
    const yr = forceYear || baseYear || new Date().getUTCFullYear();
    const mo = _SMON[m9[2]];
    const dd = parseInt(m9[1]);
    const hh = parseInt(m9[3].slice(0, 2));
    const mi = parseInt(m9[3].slice(2, 4));
    return Date.UTC(yr, mo, dd, hh, mi);
  }

  return null;
}

/**
 * Extract UTC {startMs, endMs} window from a NOTAM text string.
 * Works standalone (no window globals required).
 * Returns null if no parseable date range found.
 *
 * Supports formats:
 *   DDMMMHHmm-DDMMMHHmm[PERM]          — most Atlas OFP NOTAMs
 *   YYMMDDHHmm-YYMMDDHHmm              — ICAO 10-digit
 *   WEF DDMMMHHmm UFC/UNTIL DDMMMHHmm  — some domestic NOTAMs
 *   EFFECTIVE DDMMMHHmm UNTIL/TO ...   — plain language NOTAMs
 *   B) YYMMDDHHmm ... C) YYMMDDHHmm   — structured NOTAM items
 *
 * @param {string} notamText
 * @param {number|string|null} flightDateISO — 'YYYY-MM-DD' or null (uses current year)
 * @returns {{ startMs: number, endMs: number } | null}
 */
function xNW_standalone(notamText, flightDateISO) {
  const iso = flightDateISO ||
    (typeof window !== 'undefined' && window._flightDateISO) || null;
  const baseYear = iso ? parseInt(iso.slice(0, 4)) : new Date().getUTCFullYear();
  const tu = notamText.toUpperCase();

  // ── B/C structured items (highest confidence) ──────────────────────────
  // B) 2603010000  C) 2603312359 | PERM
  const bcRe = /B\)\s*(\d{10})\s+C\)\s*(\d{10}|PERM)/;
  const bcM  = tu.match(bcRe);
  if (bcM) {
    const startMs = _parseDateToken(bcM[1], baseYear, null);
    const endMs   = bcM[2] === 'PERM'
      ? Date.UTC(baseYear + 50, 0, 1)
      : _parseDateToken(bcM[2], baseYear, null);
    if (startMs !== null && endMs !== null) return { startMs, endMs };
  }

  // ── WEF … UFC/UNTIL … (inline effectivity) ────────────────────────────
  const wefRe = /WEF\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4})\s+(?:UFC|UNTIL|TO)\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)/i;
  const wefM  = tu.match(wefRe);
  if (wefM) {
    return _resolveInlineDateRange(wefM[1], wefM[2], baseYear);
  }

  // ── EFFECTIVE … UNTIL/TO … (plain language) ───────────────────────────
  const effRe = /EFFECTIVE\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4})\s+(?:UNTIL|TO)\s+(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)/i;
  const effM  = tu.match(effRe);
  if (effM) {
    return _resolveInlineDateRange(effM[1], effM[2], baseYear);
  }

  // ── DDMMMHHmm-DDMMMHHmm (standard Atlas inline) ──────────────────────
  // Optionally followed by a 4-digit trailing year on the end token
  const inlineRe = /(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4})-(\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{4}|PERM)(?:\s+(\d{4}))?/i;
  const inM = tu.match(inlineRe);
  if (inM) {
    const endToken      = inM[2];
    const trailingYear  = inM[3] ? parseInt(inM[3]) : null;
    if (/^PERM$/i.test(endToken)) {
      const sMs = _parseDateToken(inM[1], baseYear, baseYear);
      if (sMs === null) return null;
      return { startMs: sMs, endMs: Date.UTC(baseYear + 50, 0, 1) };
    }
    const startMo = _SMON[inM[1].slice(2, 5).toUpperCase()];
    const endMo   = _SMON[endToken.slice(2, 5).toUpperCase()];
    // Use flight month to anchor cross-year inference correctly.
    // If endMo is on or after the flight month it must be in the same year.
    // If endMo is before the flight month it has wrapped to next year.
    const flightMo = iso ? parseInt(iso.slice(5, 7)) - 1 : new Date().getUTCMonth();
    const endYear   = trailingYear ||
                      (endMo < startMo && endMo < flightMo ? baseYear + 1 : baseYear);
    const startYear = (endMo < startMo) ? endYear - 1 : endYear;
    const startMs = _parseDateToken(inM[1], baseYear, startYear);
    const endMs   = _parseDateToken(endToken, baseYear, endYear);
    if (startMs !== null && endMs !== null) return { startMs, endMs };
  }

  // ── 10-digit pair: 2603010000-2603312359 ─────────────────────────────
  const tenRe = /(\d{10})\s*[-–]\s*(\d{10})/;
  const tenM  = tu.match(tenRe);
  if (tenM) {
    const startMs = _parseDateToken(tenM[1], baseYear, null);
    const endMs   = _parseDateToken(tenM[2], baseYear, null);
    if (startMs !== null && endMs !== null) return { startMs, endMs };
  }

  return null; // no parseable date range found
}

/**
 * Helper: resolve an inline DDMMMHHmm date range, handling PERM and cross-year.
 */
function _resolveInlineDateRange(startToken, endToken, baseYear) {
  if (/^PERM$/i.test(endToken)) {
    const sMs = _parseDateToken(startToken, baseYear, baseYear);
    if (sMs === null) return null;
    return { startMs: sMs, endMs: Date.UTC(baseYear + 50, 0, 1) };
  }
  const startMo = _SMON[(startToken.slice(2, 5) || '').toUpperCase()];
  const endMo   = _SMON[(endToken.slice(2, 5) || '').toUpperCase()];
  if (startMo === undefined || endMo === undefined) return null;
  const endYear   = endMo < startMo ? baseYear + 1 : baseYear;
  const startYear = endMo < startMo ? endYear - 1 : endYear;
  const startMs   = _parseDateToken(startToken, baseYear, startYear);
  const endMs     = _parseDateToken(endToken,   baseYear, endYear);
  if (startMs === null || endMs === null) return null;
  return { startMs, endMs };
}

/**
 * Check whether a NOTAM UTC window overlaps with the ETA window (ETA ±60 min).
 * Uses full UTC millisecond comparison — immune to midnight/day rollover.
 *
 * @param {{ startMs:number, endMs:number }} w
 * @param {number|null} etaMin        — ETA as minutes-of-day (0–1439), or null
 * @param {string|null} flightDateISO — 'YYYY-MM-DD'
 * @returns {boolean}
 */
function nwOverlap_standalone(w, etaMin, flightDateISO) {
  if (etaMin === null) return true; // no ETA → treat as active
  const iso = flightDateISO ||
    (typeof window !== 'undefined' && window._flightDateISO) || null;
  if (!iso) return true; // no flight date → treat as active

  const etaMs   = new Date(iso + 'T00:00:00Z').getTime()
                  + Math.floor(etaMin / 60) * 3600000
                  + (etaMin % 60) * 60000;

  // If ETA crosses midnight, the minutes-of-day wrapped — add one day
  // Detect: if computed etaMs is more than 12 hrs before the NOTAM window start
  // (which has an absolute year), nudge the etaMs to next day.
  const nudgedEtaMs = (w.startMs - etaMs > 12 * 3600000) ? etaMs + 86400000 : etaMs;

  const winStart = nudgedEtaMs - 3600000; // ETA − 1 hour
  const winEnd   = nudgedEtaMs + 3600000; // ETA + 1 hour
  return w.startMs < winEnd && w.endMs > winStart;
}

/**
 * Convert a parseNotamTime result to a JS Date (UTC).
 * Uses current year/month for day-only formats.
 * @param {object|null} t - Result of parseNotamTime
 * @returns {Date|null}
 */
function notamTimeToDate(t) {
  if (!t || t.perm) return null;
  const now = new Date();
  if (t.year && t.month) {
    return new Date(Date.UTC(t.year, t.month - 1, t.day, t.hourZ, t.minZ, 0));
  }
  if (t.day !== undefined && t.hourZ !== undefined) {
    // Day-only format — use current month/year
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), t.day, t.hourZ, t.minZ, 0));
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// § 7 · NOTAM SCHEDULE (D-ITEM) DECODER
//       Source: ICAO Doc 4444 / FAA NOTAM formatting
// ═══════════════════════════════════════════════════════════════

/**
 * Common D-item schedule patterns and their interpretation.
 * The D-item restricts when within the B→C window the NOTAM is active.
 */
const SCHEDULE_PATTERNS = [
  // Daily during specific hours: "DAILY 0600-2200"
  {
    re:      /DAILY\s+(\d{4})-(\d{4})/i,
    parse:   (m) => ({ type: 'daily', from: m[1], to: m[2] }),
    describe:(v) => `Active daily ${v.from}–${v.to}Z`,
  },
  // Weekdays: "MON-FRI 0700-2300"
  {
    re:      /(MON|TUE|WED|THU|FRI|SAT|SUN)[- ](MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{4})-(\d{4})/i,
    parse:   (m) => ({ type: 'weekdays', dayFrom: m[1], dayTo: m[2], from: m[3], to: m[4] }),
    describe:(v) => `Active ${v.dayFrom}–${v.dayTo} ${v.from}–${v.to}Z`,
  },
  // Sunrise/Sunset: "SR-SS"
  {
    re:      /SR[-\/]SS/i,
    parse:   () => ({ type: 'sr_ss' }),
    describe:() => 'Active from sunrise to sunset (local)',
  },
  // Sunset/Sunrise: "SS-SR"
  {
    re:      /SS[-\/]SR/i,
    parse:   () => ({ type: 'ss_sr' }),
    describe:() => 'Active from sunset to sunrise (local) — night only',
  },
];

const DAY_ABBR = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 0 };

/**
 * Decode a NOTAM D-item schedule string.
 * @param {string} schedule - Raw D-item text
 * @returns {{ patterns: object[], description: string }}
 */
function decodeNotamSchedule(schedule) {
  const found = [];
  for (const pat of SCHEDULE_PATTERNS) {
    const m = schedule.match(pat.re);
    if (m) {
      const parsed = pat.parse(m);
      found.push({ ...parsed, description: pat.describe(parsed) });
    }
  }
  return {
    raw:        schedule,
    patterns:   found,
    description: found.length ? found.map(f => f.description).join('; ') : schedule,
  };
}

/**
 * Check if a given UTC time falls within a D-item schedule.
 * Returns null if schedule cannot be evaluated programmatically.
 * @param {string} schedule
 * @param {Date}   now
 * @returns {boolean|null}
 */
function isActiveInSchedule(schedule, now) {
  for (const pat of SCHEDULE_PATTERNS) {
    const m = schedule.match(pat.re);
    if (!m) continue;
    const parsed = pat.parse(m);

    if (parsed.type === 'daily') {
      const hhmm = now.getUTCHours() * 100 + now.getUTCMinutes();
      const from = parseInt(parsed.from, 10);
      const to   = parseInt(parsed.to, 10);
      if (to < from) {
        return hhmm >= from || hhmm < to; // crosses midnight
      }
      return hhmm >= from && hhmm < to;
    }

    if (parsed.type === 'weekdays') {
      const day  = now.getUTCDay();
      const hhmm = now.getUTCHours() * 100 + now.getUTCMinutes();
      const dFrom = DAY_ABBR[parsed.dayFrom.toUpperCase()];
      const dTo   = DAY_ABBR[parsed.dayTo.toUpperCase()];
      const from  = parseInt(parsed.from, 10);
      const to    = parseInt(parsed.to, 10);

      const inDayRange = dFrom <= dTo ? (day >= dFrom && day <= dTo) : (day >= dFrom || day <= dTo);
      if (!inDayRange) return false;
      return hhmm >= from && hhmm < to;
    }

    // SR/SS — cannot compute without airport location/date
    return null;
  }
  return null; // unknown schedule format
}

// ═══════════════════════════════════════════════════════════════
// § 8 · TIME CONVERSION (shared with wx-rules.js)
//       Source: FAA AIP GEN 2.1 §2 — UTC standard
// ═══════════════════════════════════════════════════════════════

/**
 * US time zone offsets from UTC.
 * Source: FAA AIP GEN 2.1 FIG GEN 2.1-1
 */
const US_TIMEZONES = {
  'AST':  -4,  'EST':  -5,  'CST':  -6,  'MST':  -7,
  'PST':  -8,  'AKST': -9,  'HST': -10,
  'ADT':  -3,  'EDT':  -4,  'CDT':  -5,  'MDT':  -6,
  'PDT':  -7,  'AKDT': -8,
  'Z': 0,'A':-1,'B':-2,'C':-3,'D':-4,'E':-5,'F':-6,'G':-7,
  'H':-8,'I':-9,'K':-10,'L':-11,'M':-12,
  'N':1,'O':2,'P':3,'Q':4,'R':5,'S':6,'T':7,'U':8,'V':9,'W':10,'X':11,'Y':12,
};

/**
 * Convert UTC HHMM to local time for a given timezone.
 * @param {string} utcHHMM  - e.g. '1430'
 * @param {string} tzAbbr   - e.g. 'EST', 'CDT'
 * @returns {{ local: string, display: string, dayShift: number }}
 */
function convertUtcToLocal(utcHHMM, tzAbbr) {
  const tz = tzAbbr.toUpperCase();
  if (!(tz in US_TIMEZONES)) throw new Error(`Unknown timezone: ${tzAbbr}`);

  const offset = US_TIMEZONES[tz];
  const h = parseInt(utcHHMM.slice(0, 2), 10);
  const m = parseInt(utcHHMM.slice(2, 4), 10);

  const totalMins = h * 60 + m + offset * 60;
  const localMins = ((totalMins % 1440) + 1440) % 1440;
  const dayShift  = Math.floor(totalMins / 1440);

  const lh = Math.floor(localMins / 60);
  const lm = localMins % 60;
  const local = String(lh).padStart(2,'0') + String(lm).padStart(2,'0');

  return { local, display: `${local} ${tz}`, dayShift };
}

// ═══════════════════════════════════════════════════════════════
// § 9 · AIRPORT TIMEZONE DATABASE
//       Maps major ICAO codes to their standard UTC offsets.
//       Used by dateutil functions in the app.
//       Source: FAA standard / ICAO timezone assignments
// ═══════════════════════════════════════════════════════════════

/**
 * Airport timezone map — standard time offsets (non-DST).
 * For DST-aware apps, apply +1 hr for US airports Apr–Nov.
 * Format: { ICAO: { tz: 'TZ_ABBR', offsetStd: number, observesDST: bool } }
 */
const AIRPORT_TIMEZONES = {
  // Alaska
  PANC: { tz:'AKST', offsetStd:-9,  observesDST:true,  city:'Anchorage, AK' },
  PAFA: { tz:'AKST', offsetStd:-9,  observesDST:true,  city:'Fairbanks, AK' },
  // Hawaii (no DST)
  PHNL: { tz:'HST',  offsetStd:-10, observesDST:false, city:'Honolulu, HI' },
  PHOG: { tz:'HST',  offsetStd:-10, observesDST:false, city:'Kahului, HI' },
  // Pacific
  KLAX: { tz:'PST',  offsetStd:-8,  observesDST:true,  city:'Los Angeles, CA' },
  KSFO: { tz:'PST',  offsetStd:-8,  observesDST:true,  city:'San Francisco, CA' },
  KSEA: { tz:'PST',  offsetStd:-8,  observesDST:true,  city:'Seattle, WA' },
  KPDX: { tz:'PST',  offsetStd:-8,  observesDST:true,  city:'Portland, OR' },
  KLAS: { tz:'PST',  offsetStd:-8,  observesDST:true,  city:'Las Vegas, NV' },
  // Mountain
  KDEN: { tz:'MST',  offsetStd:-7,  observesDST:true,  city:'Denver, CO' },
  KPHX: { tz:'MST',  offsetStd:-7,  observesDST:false, city:'Phoenix, AZ' }, // Arizona no DST
  KSLC: { tz:'MST',  offsetStd:-7,  observesDST:true,  city:'Salt Lake City, UT' },
  // Central
  KORD: { tz:'CST',  offsetStd:-6,  observesDST:true,  city:'Chicago, IL (O\'Hare)' },
  KMDW: { tz:'CST',  offsetStd:-6,  observesDST:true,  city:'Chicago, IL (Midway)' },
  KDFW: { tz:'CST',  offsetStd:-6,  observesDST:true,  city:'Dallas-Fort Worth, TX' },
  KDAL: { tz:'CST',  offsetStd:-6,  observesDST:true,  city:'Dallas Love Field, TX' },
  KIAH: { tz:'CST',  offsetStd:-6,  observesDST:true,  city:'Houston (Intercontinental), TX' },
  KMSP: { tz:'CST',  offsetStd:-6,  observesDST:true,  city:'Minneapolis, MN' },
  KSTL: { tz:'CST',  offsetStd:-6,  observesDST:true,  city:'St. Louis, MO' },
  KMSY: { tz:'CST',  offsetStd:-6,  observesDST:true,  city:'New Orleans, LA' },
  KSAT: { tz:'CST',  offsetStd:-6,  observesDST:true,  city:'San Antonio, TX' },
  KCVG: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Cincinnati, OH' }, // KY side = ET
  // Eastern
  KJFK: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'New York (JFK), NY' },
  KLGA: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'New York (LaGuardia), NY' },
  KEWR: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Newark, NJ' },
  KBOS: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Boston, MA' },
  KMIA: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Miami, FL' },
  KMCO: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Orlando, FL' },
  KATL: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Atlanta, GA' },
  KDTW: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Detroit, MI' },
  KIAD: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Washington Dulles, VA' },
  KDCA: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Washington National, DC' },
  KBWI: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Baltimore, MD' },
  KPHL: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Philadelphia, PA' },
  KPIT: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Pittsburgh, PA' },
  KCLT: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Charlotte, NC' },
  KBDL: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Hartford/Springfield, CT' },
  KRDU: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Raleigh-Durham, NC' },
  KTPA: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Tampa, FL' },
  // Territories
  TJSJ: { tz:'AST',  offsetStd:-4,  observesDST:false, city:'San Juan, PR' }, // PR no DST
  NSTU: { tz:'SST',  offsetStd:-11, observesDST:false, city:'Pago Pago, American Samoa' },
  // Canada (common)
  CYYZ: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Toronto, Canada' },
  CYVR: { tz:'PST',  offsetStd:-8,  observesDST:true,  city:'Vancouver, Canada' },
  CYMX: { tz:'EST',  offsetStd:-5,  observesDST:true,  city:'Montreal, Canada' },
  // Europe (common transatlantic destinations)
  EGLL: { tz:'UTC',  offsetStd:0,   observesDST:true,  city:'London Heathrow, UK' },
  LFPG: { tz:'CET',  offsetStd:1,   observesDST:true,  city:'Paris CDG, France' },
  EDDF: { tz:'CET',  offsetStd:1,   observesDST:true,  city:'Frankfurt, Germany' },
  LEMD: { tz:'CET',  offsetStd:1,   observesDST:true,  city:'Madrid, Spain' },
  EHAM: { tz:'CET',  offsetStd:1,   observesDST:true,  city:'Amsterdam, Netherlands' },
  LSZH: { tz:'CET',  offsetStd:1,   observesDST:true,  city:'Zurich, Switzerland' },
  LIRF: { tz:'CET',  offsetStd:1,   observesDST:true,  city:'Rome, Italy' },
  LOWW: { tz:'CET',  offsetStd:1,   observesDST:true,  city:'Vienna, Austria' },
  EPWA: { tz:'CET',  offsetStd:1,   observesDST:true,  city:'Warsaw, Poland' },
  UUEE: { tz:'MSK',  offsetStd:3,   observesDST:false, city:'Moscow, Russia' },
  // Middle East
  OMDB: { tz:'GST',  offsetStd:4,   observesDST:false, city:'Dubai, UAE' },
  OERK: { tz:'AST3', offsetStd:3,   observesDST:false, city:'Riyadh, Saudi Arabia' },
  OTBD: { tz:'AST3', offsetStd:3,   observesDST:false, city:'Doha, Qatar' },
  // Asia-Pacific
  VHHH: { tz:'HKT',  offsetStd:8,   observesDST:false, city:'Hong Kong' },
  RJTT: { tz:'JST',  offsetStd:9,   observesDST:false, city:'Tokyo Haneda, Japan' },
  RJAA: { tz:'JST',  offsetStd:9,   observesDST:false, city:'Tokyo Narita, Japan' },
  RKSI: { tz:'KST',  offsetStd:9,   observesDST:false, city:'Seoul Incheon, Korea' },
  ZBAA: { tz:'CST8', offsetStd:8,   observesDST:false, city:'Beijing, China' },
  ZSSS: { tz:'CST8', offsetStd:8,   observesDST:false, city:'Shanghai, China' },
  WSSS: { tz:'SGT',  offsetStd:8,   observesDST:false, city:'Singapore' },
  VTBS: { tz:'ICT',  offsetStd:7,   observesDST:false, city:'Bangkok, Thailand' },
  WMKK: { tz:'MYT',  offsetStd:8,   observesDST:false, city:'Kuala Lumpur, Malaysia' },
  YSSY: { tz:'AEST', offsetStd:10,  observesDST:true,  city:'Sydney, Australia' },
  YMML: { tz:'AEST', offsetStd:10,  observesDST:true,  city:'Melbourne, Australia' },
  // Latin America
  SBGR: { tz:'BRT',  offsetStd:-3,  observesDST:false, city:'São Paulo, Brazil' },
  SAEZ: { tz:'ART',  offsetStd:-3,  observesDST:false, city:'Buenos Aires, Argentina' },
  MMMX: { tz:'CST',  offsetStd:-6,  observesDST:true,  city:'Mexico City, Mexico' },
  // Africa
  FAOR: { tz:'SAST', offsetStd:2,   observesDST:false, city:'Johannesburg, South Africa' },
  HECA: { tz:'EET',  offsetStd:2,   observesDST:false, city:'Cairo, Egypt' },
};

/**
 * Get the UTC offset for an airport by ICAO code.
 * Accounts for DST if isDST = true.
 * @param {string} icao
 * @param {boolean} [isDST=false]
 * @returns {{ offset: number, tzAbbr: string, city: string } | null}
 */
function getAirportTimezone(icao, isDST = false) {
  const apt = AIRPORT_TIMEZONES[icao.toUpperCase()];
  if (!apt) return null;
  const offset = apt.observesDST && isDST ? apt.offsetStd + 1 : apt.offsetStd;
  return { offset, tzAbbr: apt.tz, city: apt.city, observesDST: apt.observesDST };
}

/**
 * Convert a UTC HHMM time to local time at an airport.
 * @param {string} utcHHMM
 * @param {string} icao
 * @param {boolean} [isDST=false]
 * @returns {object|null}
 */
function airportLocalTime(utcHHMM, icao, isDST = false) {
  const tz = getAirportTimezone(icao, isDST);
  if (!tz) return null;
  return {
    ...convertUtcToLocal(utcHHMM, tz.offset),
    tzAbbr: tz.tzAbbr,
    city:   tz.city,
    icao:   icao.toUpperCase(),
  };
}


// ═══════════════════════════════════════════════════════════════
// § 10 · UNIVERSAL NOTAM EVALUATION ENGINE
//        notam-notam-rules-reference.md §10
//
//  evalNotams(notams, role, etaMin, acftType, flightDateISO)
//
//  Returns a sorted array of issue objects ready for airport card display.
//  Each issue: { slot, level, text, active, notamRaw }
//
//  Display order per role:
//
//  ORIG (departure window):
//    1  Closed runways
//    2  Closed / wingspan-restricted taxiways
//    3  SID changes
//    4  Approach changes (procedure or minimums)
//    5  Alternate missed approach changes
//    6  All other NOTAMs active during the departure period
//    7  All other NOTAMs (outside period / informational)
//
//  DEST / ALT (arrival window):
//    1  Closed runways
//    2  U/S approaches (ILS/LOC/GS/GLS/RNAV unserviceable)
//    3  Approach changes (procedure or minimums)
//    4  Alternate missed approach changes
//    5  STAR changes
//    6  Closed / wingspan-restricted taxiways
//    7  Other NOTAMs active during the arrival period
//    8  All other NOTAMs (outside period / informational)
//
//  Highlighting:
//    RED   — closures (CLSD), unserviceable (U/S, OTS, INOP, UNUSBL)
//    YELLOW — restrictions, changes, limitations
//
//  Significant keywords within the NOTAM text are wrapped:
//    <span class="nt-red">KEYWORD</span>   for RED items
//    <span class="nt-yel">KEYWORD</span>   for YELLOW items
// ═══════════════════════════════════════════════════════════════

// ── Aircraft data database
// ── Source: Jane's / manufacturer type certificate data sheets / FAA AC 150/5300-13A
// Fields per entry:
//   ws   — wingspan metres (maximum, wingtip to wingtip)
//   mtow — max takeoff weight kg (approximate max certified)
//   code — ICAO aerodrome reference code letter (A–F) derived from wingspan
//          A: <15m  B: 15–24m  C: 24–36m  D: 36–52m  E: 52–65m  F: >65m
//   wake — ICAO wake turbulence category: L/M/H/J (Light/Medium/Heavy/Super)
//   turbine — true = jet/turboprop (false = piston — rare in commercial ops)
const AIRCRAFT_DATA = {
  // ── Narrowbody ──
  B735: { ws:28.9, mtow:52390,  code:'C', wake:'M', turbine:true },
  B736: { ws:28.9, mtow:56245,  code:'C', wake:'M', turbine:true },
  B737: { ws:28.9, mtow:56245,  code:'C', wake:'M', turbine:true },
  B738: { ws:35.8, mtow:79016,  code:'C', wake:'M', turbine:true },
  B739: { ws:35.8, mtow:85139,  code:'C', wake:'M', turbine:true },
  B37M: { ws:35.9, mtow:82191,  code:'C', wake:'M', turbine:true },
  B38M: { ws:35.9, mtow:82191,  code:'C', wake:'M', turbine:true },
  B39M: { ws:35.9, mtow:88314,  code:'C', wake:'M', turbine:true },
  A19N: { ws:35.8, mtow:75500,  code:'C', wake:'M', turbine:true },
  A20N: { ws:35.8, mtow:79000,  code:'C', wake:'M', turbine:true },
  A21N: { ws:35.8, mtow:97000,  code:'C', wake:'M', turbine:true },
  A318: { ws:34.1, mtow:68000,  code:'C', wake:'M', turbine:true },
  A319: { ws:33.9, mtow:75500,  code:'C', wake:'M', turbine:true },
  A320: { ws:33.9, mtow:77000,  code:'C', wake:'M', turbine:true },
  A321: { ws:35.8, mtow:93500,  code:'C', wake:'M', turbine:true },
  E190: { ws:28.7, mtow:51800,  code:'C', wake:'M', turbine:true },
  E195: { ws:28.7, mtow:52290,  code:'C', wake:'M', turbine:true },
  E75L: { ws:26.0, mtow:38790,  code:'C', wake:'M', turbine:true },
  E75S: { ws:26.0, mtow:37500,  code:'C', wake:'M', turbine:true },
  CRJ2: { ws:21.2, mtow:21319,  code:'B', wake:'L', turbine:true },
  CRJ7: { ws:23.2, mtow:33113,  code:'C', wake:'M', turbine:true },
  CRJ9: { ws:24.9, mtow:36514,  code:'C', wake:'M', turbine:true },
  CRJX: { ws:26.2, mtow:42184,  code:'C', wake:'M', turbine:true },
  DH8D: { ws:28.4, mtow:29257,  code:'C', wake:'M', turbine:true },
  AT76: { ws:27.1, mtow:23000,  code:'C', wake:'M', turbine:true },
  AT75: { ws:27.1, mtow:22800,  code:'C', wake:'M', turbine:true },
  // ── Widebody — long haul ──
  B744: { ws:64.4, mtow:412800, code:'E', wake:'H', turbine:true },
  B748: { ws:68.4, mtow:447700, code:'F', wake:'H', turbine:true },
  BLCF: { ws:68.4, mtow:447700, code:'F', wake:'H', turbine:true }, // 747-400LCF Dreamlifter
  B762: { ws:47.6, mtow:175540, code:'D', wake:'H', turbine:true },
  B763: { ws:47.6, mtow:186900, code:'D', wake:'H', turbine:true },
  B764: { ws:51.9, mtow:204120, code:'D', wake:'H', turbine:true },
  B772: { ws:60.9, mtow:297550, code:'E', wake:'H', turbine:true },
  B77L: { ws:64.8, mtow:347800, code:'E', wake:'H', turbine:true },
  B77W: { ws:64.8, mtow:352440, code:'E', wake:'H', turbine:true },
  B778: { ws:71.8, mtow:352400, code:'F', wake:'H', turbine:true },
  B779: { ws:71.8, mtow:352400, code:'F', wake:'H', turbine:true },
  B788: { ws:60.1, mtow:227930, code:'E', wake:'H', turbine:true },
  B789: { ws:60.1, mtow:254011, code:'E', wake:'H', turbine:true },
  B78X: { ws:60.1, mtow:254011, code:'E', wake:'H', turbine:true },
  A306: { ws:44.8, mtow:171700, code:'D', wake:'H', turbine:true },
  A310: { ws:43.9, mtow:157000, code:'D', wake:'H', turbine:true },
  A332: { ws:60.3, mtow:242000, code:'E', wake:'H', turbine:true },
  A333: { ws:60.3, mtow:242000, code:'E', wake:'H', turbine:true },
  A338: { ws:64.0, mtow:251000, code:'E', wake:'H', turbine:true },
  A339: { ws:64.0, mtow:251000, code:'E', wake:'H', turbine:true },
  A342: { ws:60.3, mtow:233000, code:'E', wake:'H', turbine:true },
  A343: { ws:60.3, mtow:276500, code:'E', wake:'H', turbine:true },
  A345: { ws:63.5, mtow:372000, code:'E', wake:'H', turbine:true },
  A346: { ws:63.5, mtow:380000, code:'E', wake:'H', turbine:true },
  A359: { ws:64.8, mtow:280000, code:'E', wake:'H', turbine:true },
  A35K: { ws:64.8, mtow:308000, code:'E', wake:'H', turbine:true },
  A380: { ws:79.8, mtow:575000, code:'F', wake:'J', turbine:true },
  A388: { ws:79.8, mtow:575000, code:'F', wake:'J', turbine:true },
  // ── Freighters / misc ──
  B752: { ws:38.1, mtow:115900, code:'D', wake:'H', turbine:true },
  B753: { ws:38.1, mtow:122470, code:'D', wake:'H', turbine:true },
  B722: { ws:39.9, mtow:95028,  code:'D', wake:'H', turbine:true },
  MD11: { ws:51.7, mtow:283000, code:'D', wake:'H', turbine:true },
  DC10: { ws:47.3, mtow:255825, code:'D', wake:'H', turbine:true },
  C17:  { ws:51.7, mtow:265350, code:'D', wake:'H', turbine:true },
  C130: { ws:40.4, mtow:70305,  code:'D', wake:'M', turbine:true },
  C5:   { ws:67.9, mtow:381024, code:'F', wake:'H', turbine:true },
};

// Backward-compatible AIRCRAFT_WINGSPAN (keyed by same designators)
const AIRCRAFT_WINGSPAN = Object.fromEntries(
  Object.entries(AIRCRAFT_DATA).map(([k,v]) => [k, v.ws])
);

/**
 * Get aircraft wingspan in metres from ICAO type designator.
 * Returns null if type is not in the database.
 * @param {string} acftType - e.g. 'B738', 'B77W', 'A321'
 * @returns {number|null}
 */
function getWingspan(acftType) {
  if (!acftType) return null;
  const d = AIRCRAFT_DATA[acftType.toUpperCase().slice(0,4)];
  return d ? d.ws : null;
}

/**
 * Build a complete aircraft profile from an ICAO type designator.
 * Used by _acftApplies() to evaluate all applicability constraints.
 *
 * The profile is derived from AIRCRAFT_DATA. For unknown types a
 * conservative (worst-case) profile is returned so NOTAMs are not
 * silently suppressed.
 *
 * @param {string} icaoType — e.g. 'B748', 'B77W', 'BLCF'
 * @returns {{
 *   type: string,
 *   ws: number,        — wingspan metres
 *   mtow: number,      — MTOW kg
 *   code: string,      — ICAO aerodrome ref code A–F
 *   wake: string,      — ICAO wake cat: L/M/H/J
 *   turbine: boolean,  — jet/turboprop = true
 *   known: boolean     — false if type not in database
 * }}
 */
function buildAcftProfile(icaoType) {
  const key = (icaoType || '').toUpperCase().slice(0, 4);
  const d = AIRCRAFT_DATA[key];
  if (d) return { type: key, ...d, known: true };
  // Unknown type — conservative: assume heavy, wide-body, turbine
  // so we never silently drop a NOTAM that might apply
  return { type: key || 'UNKN', ws: 999, mtow: 999999, code: 'F', wake: 'H', turbine: true, known: false };
}

/**
 * Determine whether a NOTAM applies to the given aircraft.
 *
 * Replaces the taxiway-only _twyApplies with a comprehensive filter
 * covering all applicability constraints found in real NOTAM text.
 *
 * Conservative approach: when uncertain, return true (show the NOTAM).
 * Only return false when the NOTAM explicitly excludes this aircraft type.
 *
 * Sources:
 *   FAA AIP GEN 3.1 §5 — NOTAM applicability
 *   ICAO Doc 4444 App 6 — Q-line traffic codes (I/V/IV)
 *   ICAO Annex 14 Table 1-1 — Aerodrome reference codes
 *
 * @param {string} notamText   — raw NOTAM text (any case)
 * @param {object|string} acft — acftProfile from buildAcftProfile(), or ICAO type string
 * @returns {boolean}  true = NOTAM applies (show it); false = does not apply (suppress)
 */
function _acftApplies(notamText, acft) {
  // Accept either a profile object or a type string for backward compatibility
  const profile = (typeof acft === 'string') ? buildAcftProfile(acft) : (acft || buildAcftProfile(''));
  const nu = notamText.toUpperCase();

  // ── 1. Wingspan / width limits ─────────────────────────────────────────
  // Patterns: "WS 36M", "MAX WS 60M", "WINGSPAN 52M", "WIDTH LTD 36M",
  //           "MAX ACFT SPAN 60M", "WIDTH LIMITED TO 36M"
  const wsM = nu.match(
    /(?:MAX\s+)?(?:WINGSPAN|ACFT\s+SPAN|WS)\s*(?:LIMITED?\s+TO\s+|LTD\s+TO\s+|OF\s+)?:?\s*(\d+(?:\.\d+)?)\s*M\b|WIDTH(?:\s+\w+){0,3}\s+(\d+(?:\.\d+)?)\s*M\b/i
  );
  if (wsM) {
    const limitM = parseFloat(wsM[1] || wsM[2]);
    if (!isNaN(limitM)) {
      // Show NOTAM if our wingspan exceeds the limit (applies to us)
      return profile.ws > limitM;
    }
  }

  // ── 2. Max MTOW limits ─────────────────────────────────────────────────
  // Patterns: "MAX MTOW 75000KG", "ACFT MAX 5700 KG", "OVER 12500 LBS PROHIBITED"
  const mtowKgM = nu.match(/(?:MAX\s+)?(?:MTOW|TOW|TAKEOFF\s+WEIGHT|TOW)\s*(?:OF\s+)?(\d[\d,]*)\s*(?:T\b|TONNES?|KG)\b/i);
  if (mtowKgM) {
    const limitKg = parseFloat(mtowKgM[1].replace(/,/g,''));
    if (!isNaN(limitKg)) return profile.mtow > limitKg;
  }
  // Pounds: "ACFT OVER 12500 LBS PROHIBITED"
  const mtowLbsM = nu.match(/(?:ACFT\s+)?(?:OVER|ABOVE|GREATER\s+THAN|>)\s*(\d[\d,]*)\s*(?:LBS?|POUNDS?)\s+(?:PROHIBITED|NOT\s+AUTH|NA)\b/i);
  if (mtowLbsM) {
    const limitLbs = parseFloat(mtowLbsM[1].replace(/,/g,''));
    if (!isNaN(limitLbs)) return profile.mtow * 2.20462 > limitLbs;
  }

  // ── 3. Wake turbulence category restrictions ───────────────────────────
  // "HEAVY ACFT ONLY" — applies to Heavy and Super
  if (/\bHEAVY\s+ACFT\s+ONLY\b|\bFOR\s+HEAVY\s+ACFT\b|\bHEAVY\s+AND\s+SUPER\b/i.test(nu)) {
    return profile.wake === 'H' || profile.wake === 'J';
  }
  // "HEAVY ACFT NOT AUTH" / "HEAVY ACFT PROHIBITED" — applies to us (we are heavy)
  if (/\bHEAVY\s+ACFT\s+(?:NOT\s+AUTH|PROHIBITED|NA)\b/i.test(nu)) {
    return profile.wake === 'H' || profile.wake === 'J';
  }
  // "LIGHT ACFT ONLY" — does not apply to Heavy/Super
  if (/\bLIGHT\s+ACFT\s+ONLY\b|\bSMALL\s+ACFT\s+ONLY\b/i.test(nu)) {
    return profile.wake === 'L';
  }

  // ── 4. Aerodrome reference code restrictions ───────────────────────────
  // "CODE E AND F ACFT", "CAT F ACFT ONLY", "CODE E/F AIRCRAFT"
  const codeM = nu.match(/(?:CODE|CAT(?:EGORY)?)\s+([A-F](?:\s*(?:AND|\/|,)\s*[A-F])*)\s+(?:ACFT|AIRCRAFT)/i);
  if (codeM) {
    const codes = codeM[1].replace(/\s+/g,'').split(/AND|\/|,/i).map(s=>s.trim());
    return codes.includes(profile.code);
  }
  // "CODE F ONLY"
  const codeSingle = nu.match(/\bCODE\s+([A-F])\s+(?:ONLY|ACFT)\b/i);
  if (codeSingle) return codeSingle[1] === profile.code;

  // ── 5. Explicit type mentions ──────────────────────────────────────────
  // Patterns: "A380 PROHIBITED", "B747 AND ABOVE PROHIBITED", "B737 AND SMALLER ONLY"
  // Type mention regex — catches B7XX, A3XX, B7XXX, MD11, DC10 etc
  const TYPE_RE = /\b(A380|A388|B748|B744|B77[WL]|B772|B778|B779|B76[234]|B75[23]|B73[5-9]|B37M|B38M|B39M|A32[0-1]|A31[89]|A33[23]|A33[89]|A34[23456]|A35[9K]|MD11|DC10|BLCF)\b/gi;
  const typeMentions = [...nu.matchAll(TYPE_RE)].map(m => m[1].toUpperCase());
  if (typeMentions.length > 0) {
    const myType = profile.type.toUpperCase();
    // Direct match — NOTAM mentions our type
    if (typeMentions.includes(myType)) return true;
    // "X AND ABOVE PROHIBITED" — check if we are heavier/larger
    if (/\bAND\s+ABOVE\s+(?:PROHIBITED|NOT\s+AUTH|NA)\b/i.test(nu)) {
      // Use wingspan as proxy for "and above" — if we are larger than listed types, applies
      const listedWs = typeMentions.map(t => (AIRCRAFT_DATA[t.slice(0,4)] || {}).ws || 0);
      const maxListedWs = Math.max(...listedWs, 0);
      return profile.ws >= maxListedWs;
    }
    // "X AND SMALLER ONLY" — does not apply to us if we are larger
    if (/\bAND\s+SMALLER\s+ONLY\b/i.test(nu)) {
      const listedWs = typeMentions.map(t => (AIRCRAFT_DATA[t.slice(0,4)] || {}).ws || 999);
      const maxListedWs = Math.max(...listedWs, 0);
      return profile.ws <= maxListedWs;
    }
    // Type list with PROHIBITED/NOT AUTH — applies to us only if we are listed
    if (/\b(?:PROHIBITED|NOT\s+AUTHORIZED|NOT\s+AUTH|NA)\b/i.test(nu)) {
      return typeMentions.includes(myType);
    }
    // Type list with ONLY — applies to us only if we are in the list
    if (/\bONLY\b/i.test(nu)) {
      return typeMentions.includes(myType);
    }
  }

  // ── 6. Turbine / jet applicability ────────────────────────────────────
  // "JET ACFT PROHIBITED" — applies to us (we are turbine)
  if (/\b(?:JET|TURBOJET|TURBOFAN|TURBINE)\s+ACFT\s+(?:PROHIBITED|NOT\s+AUTH|NA)\b/i.test(nu)) {
    return profile.turbine; // applies to us if we are turbine (jet cargo always is)
  }
  // "PROP ACFT ONLY" / "PISTON ONLY" — does not apply to jets
  if (/\b(?:PROP(?:ELLER)?|PISTON)\s+(?:ACFT\s+)?ONLY\b/i.test(nu)) {
    return !profile.turbine;
  }

  // ── 7. No restricting qualifier found — applies to all aircraft ────────
  return true;
}

// Backward-compatible alias so existing TWY calls still work
function _twyApplies(notamText, acftType) {
  return _acftApplies(notamText, acftType);
}
// ── Source: ICAO Doc 4444 App 6 / FAA AIP GEN 3.1 §5
const NM = {
  // ── Shared ──
  AD_CLSD:    /\bAD\s+CLSD\b|\bAIRPORT\s+CLSD\b/,
  // RWY_CLSD: match explicit RWY N CLSD or RWY ALL CLSD.
  // Also catches "RWY 06L/24R CLSD" and "RWY 06L CLSD EXC..." patterns.
  RWY_CLSD:   /\bRWY\s+(?:ALL\s+CLSD|\d{2}[LCRB]?(?:\s*(?:\/|AND)\s*\d{2}[LCRB]?)?\s+CLSD)\b/,
  RWY_ID:     /RWY\s+(\d{2}[LCRB]?(?:\s*(?:\/|AND)\s*\d{2}[LCRB]?)?)/,
  // RWY_ID_ALL: extract ALL runway identifiers from a NOTAM (for grouping)
  RWY_ID_ALL: /RWY\s+(\d{2}[LCRB]?)/gi,

  TWY_CLSD:   /\bTWY\s+[A-Z0-9]+(?:\s*[,\/]\s*[A-Z0-9]+)*\s+CLSD\b/,
  TWY_RESTR:  /\bTWY\s+[A-Z0-9]+(?:\s*[,\/]\s*[A-Z0-9]+)*.*?(?:RESTR|RESTRICTED|WIDTH\s+LTD|WS\s+LTD|WINGSPAN|ACFT\s+SPAN|SPAN\s+LTD|MAX\s+WS|WS\s+\d+M|WINGSP)/i,
  TWY_ID:     /TWY\s+([A-Z0-9]+(?:\s*[,\/]\s*[A-Z0-9]+)*)/,
  TWY_WS:     /WS\s+(\d+(?:\.\d+)?)\s*M|WIDTH\s+(\d+(?:\.\d+)?)\s*M|MAX\s+WS\s+(\d+(?:\.\d+)?)\s*M|WINGSPAN\s+(\d+(?:\.\d+)?)\s*M/i,
  TWY_TYPE:   /(?:B7[0-9]{2}|A3[0-9]{2}|B[0-9]{3}[A-Z]?|A[0-9]{3}[A-Z]?)\b/g,

  // ── ORIG slots ──
  SID:        /\bSID\b.*?(?:AMDT|CHANGE|INOP|CLSD|TEMP|PROC|PROC\s+CHANGE|NOT\s+AVBL|SUSPENDED)/i,
  SID_NAME:   /\bSID\s+([A-Z]+\d[A-Z]?\b)/,

  // ── DEST/ALT slots ──

  // ── Tier 1: Precision approach / guidance equipment ─────────────────────
  // GS_US: Glide slope / glide path specifically unserviceable (ILS degrades to LOC-only)
  // Catches: "GS U/S", "GLIDE SLOPE INOP", "G/P OTS", "GP UNSERVICEABLE"
  GS_US:      /\b(?:G[\/\-]?[SP]|GLIDE\s+(?:SLOPE|PATH)|GLIDESLOPE)\s*(?:U\/S|UNSERVICEABLE|OTS|INOP|INOPERATIVE|NOT\s+AVBL|UNUSBL)\b/i,

  // LOC_US: Localizer specifically unserviceable (named with full word)
  // "LOC RWY 06L U/S" is caught by APCH_US, but "LOCALIZER RWY 24R INOP" is not.
  LOC_US:     /\bLOCALIZ(?:ER|OR)\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL)\b/i,

  // APCH_US: entire approach system unserviceable (ILS/LOC/GLS/RNAV/VOR/NDB)
  APCH_US:    /(?:ILS|LOC|GLS|RNAV|LDA|SDF|NDB|VOR|GBAS)\s+(?:[A-Z]\s+)?(?:RWY\s+\d{2}[LCRB]?\s+)?(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL|UNRELIABLE|UNREL)\b/i,

  // ── Tier 2: DME — affects approach segments and missed approach climb ───
  // DME_US: DME unserviceable, including ILS DME, VOR/DME, standalone DME
  // Operationally: may raise DA/MDA on DME-required approaches; some Cat III require DME
  DME_US:     /\b(?:ILS\s+)?(?:VOR\/)?DME\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL|UNREL)\b|\bDME\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL)\b/i,

  // VORTAC_US: VORTAC unserviceable — TACAN component used for DME ranging
  VORTAC_US:  /\bVORTAC\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL)\b/i,

  // ── Tier 3: Marker beacons — OM/MM/IM affect decision altitude awareness ─
  // OM/MM/IM/LOM (compass locator) unserviceable
  // Atlas OFP text: "OM U/S", "OUTER MARKER INOP", "LOM OTS", "MM INOP"
  MARKER_US:  /\b(?:OUTER\s+MARKER|MIDDLE\s+MARKER|INNER\s+MARKER|COMPASS\s+LOCATOR|LOM|LMM|OM|MM|IM)\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL)\b|\b(?:OM|MM|IM|LOM|LMM)\s+(?:U\/S|OTS|INOP)\b/i,

  // ── Tier 4: GPS/GNSS/RAIM — affects all RNAV/RNP approaches ─────────────
  // GPS_US: GPS or GNSS signal unavailable or unreliable
  // Operationally: all RNP/RNAV/LPV/LNAV approaches become NA
  GPS_US:     /\b(?:GPS|GNSS|SATNAV)\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL|UNRELIABLE|UNREL|INTERFERENCE|DEGRADED)\b|\b(?:GPS|GNSS)\s+(?:SIGNAL\s+)?(?:UNRELIABLE|UNREL|DEGRADED|LOST|JAMMING|JAM)\b/i,
  // RAIM_NA: RAIM not available — RNP approaches require predictive RAIM
  RAIM_NA:    /\bRAIM\b.*?\b(?:NOT\s+AVBL|NOT\s+AVAILABLE|UNAVBL|NA\b|PREDICTED\s+OUTAGE|OUTAGE)\b/i,

  // ── Tier 5: Approach lighting — directly raises published minimums ───────
  // Source: FAA AIM §2-1-1; approach lighting categories affect ceiling/vis requirements
  // ALS_US: any approach lighting system unserviceable (raises MDA/DA by category)
  // Catches: ALS, ALSF-1, ALSF-2, SSALS, SSALF, SSALR, MALSR, MALSF, MALS, ODALS, RAIL
  ALS_US:     /\b(?:ALS[FR]?-?\d?|ALSF-[12]|SSALS?[FR]?|MALSR?[F]?|MALS\b|ODALS|RAIL|APPROACH\s+LIGHT(?:ING)?S?)\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL)\b/i,

  // REIL_US: Runway End Identifier Lights — unserviceable
  REIL_US:    /\bREIL\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL)\b/i,

  // PAPI_US: PAPI or VASI unserviceable — visual glide path indicator lost
  // Operationally: may raise minimums on visual approaches and some IFR procedures
  PAPI_US:    /\b(?:PAPI|VASI|PVASI|APAPI|T-VASIS?|AVASIS?)\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL)\b/i,

  // ── Tier 6: Runway lighting — affects all-weather operations ─────────────
  // HIRL/MIRL unserviceable — high/medium intensity runway edge lights
  // Operationally: may restrict operations to RVR limits where lighting is required
  RWY_LGTS_US:/\b(?:HIRL|MIRL|LIRL|REIL|HIL|MIL|RUNWAY\s+EDGE\s+LIGHTS?|RUNWAY\s+LIGHTS?)\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL)\b/i,

  // RCLL_US: Runway centerline lights — required for Cat II/III and low-visibility ops
  RCLL_US:    /\b(?:RCLL?|RCLM|RUNWAY\s+(?:CENTERLINE|CENTRE\s+LINE)\s+LIGHTS?|CL\s+LIGHTS?)\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL)\b/i,

  // TDZ_US: Touchdown zone lights — Cat II/III requirement
  TDZ_US:     /\b(?:TDZL?|TDZ\s+LIGHTS?|TOUCHDOWN\s+ZONE\s+LIGHTS?)\b.*?\b(?:U\/S|UNSERVICEABLE|OTS|INOP|NOT\s+AVBL|UNUSBL)\b/i,

  // ── Tier 7: Threshold displacement — affects declared distances ──────────
  // Displaced threshold changes landing distance available (LDA) — ops planning impact
  DSPLCD_THR: /\b(?:DSPLCD?\s+(?:THR|THLD?|THRESHOLD)|THRESHOLD\s+(?:RWY\s+\d{2}[LCRB]?\s+)?DISPLACED?|DISPLACED?\s+(?:THR|THLD?|THRESHOLD))\b/i,

  // ── APCH_CHG: approach procedure text changed, minimums raised, procedure suspended
  APCH_CHG:   /(?:ILS|LOC|GLS|RNAV|LDA|SDF|NDB|VOR|GBAS|IFR\s+APCH|INSTRUMENT\s+APCH|APCH\s+PROC|APPROACH\s+PROC).*?(?:AMDT|CHANGE|REVISED|TEMP|MINIMA\s+RAISED|DA\s+RAISED|MDA\s+RAISED|MIN\s+RAISED|PROC\s+NA|PROC\s+SUSPENDED|NOT\s+AUTHORIZED|CAT\s+[I]{1,3}\s+(?:NOT\s+AUTH|NA|SUSPENDED)|INCREASED\s+FR\s+\d)/i,
  APCH_MIN:   /(?:DA|DH|MDA|MDH|CAT\s+[I]{1,3})\s+(?:RAISED|INCREASED|AMENDED|CHANGED|REVISED)/i,

  // APCH_NAME: extract approach type + runway — extended to handle Atlas "ILS Z RWY 07" patterns
  // Group 1 = approach type/designator, Group 2 = runway
  APCH_NAME:  /(?:(ILS\s*[A-Z]?|LOC|RNAV(?:\s*\([A-Z]+\))?\s*[A-Z]?|RNP\s*[A-Z]?|VOR(?:\/DME)?|NDB|LDA|GLS|GBAS))\s+(?:RWY\s+)?(\d{2}[LCRB]?)/i,
  // APCH_RWY: extract just the runway number from an approach NOTAM (for grouping)
  APCH_RWY:   /(?:ILS|LOC|GLS|RNAV|RNP|VOR|NDB|LDA|GBAS|GS|G\/S|G\/P|GP|IFR\s+APCH|APPROACH|IAP).*?RWY\s+(\d{2}[LCRB]?)/i,

  // APCH_TYPE_NA: a specific approach type (not the full ILS) is not available
  APCH_TYPE_NA: /(?:LOC\s+ONLY|BACKCOURSE.*(?:NA|NOT\s+AVBL|OTS)|VOR\s+APCH.*(?:NA|NOT\s+AVBL)|NDB\s+APCH.*(?:NA|NOT\s+AVBL)|CAT\s+I\s+ONLY|PRECISION\s+APCH.*(?:NA|NOT\s+AVBL))/i,

  // ALT_MINS_CHG: alternate minimums specifically changed
  ALT_MINS_CHG: /(?:ALTN\s+MINS?|ALTERNATE\s+MINS?|ALT\s+MINS?|ALTERNATE\s+MINIMUMS?).*?(?:CHANGE|CHANGED|REVISED|AMENDED|RAISED|INCREASED|NOT\s+STANDARD|NA\b|NOT\s+AVBL|N\/A)/i,

  ALT_MA:     /(?:ALTN\s+PROC|ALTN\s+MA\b|ALTERNATE.*MISSED|MISSED.*APCH.*(?:PROC|CHANGE|AMDT)|ALTN.*APCH\s+PROC|MA\s+PROC\s+ALTN|ALTN.*RWY.*PROC)/i,

  STAR:       /\bSTAR\b.*?(?:AMDT|CHANGE|INOP|CLSD|TEMP|PROC|PROC\s+CHANGE|NOT\s+AVBL|SUSPENDED)/i,
  STAR_NAME:  /\bSTAR\s+([A-Z]+\d[A-Z]?\b)/,

  // ── Unserviceability keywords (RED) ──
  US_WORDS:   /\b(?:U\/S|UNSERVICEABLE|OTS|OUT\s+OF\s+SERVICE|INOP|INOPERATIVE|UNUSBL|UNUSABLE|NOT\s+AVBL|NOT\s+AVAILABLE|UNRELIABLE|UNREL)\b/i,
  // ── Closure keywords (RED) ──
  CLSD_WORDS: /\bCLSD\b|\bCLOSED\b/i,
  // ── Restriction/change keywords (YELLOW) ──
  RESTR_WORDS:/\b(?:RESTR|RESTRICTED|CHANGE|CHANGED|AMDT|AMENDED|REVISED|TEMP|TEMPORARY|LIMIT|LIMITED|RAISED|INCREASED|NOT\s+AUTH|NOT\s+AUTHORIZED|SUSPENDED|PROC\s+NA|CAT\s+[I]{1,3}\s+(?:NA|NOT\s+AUTH))\b/i,

  // ── Active NOTAM — generic active marker ──
  CURFEW:     /\bCURFEW\b|\bNOISE\s+ABATEMENT.*CLSD\b|\bLDG\s+CLSD\b|\bTKOF\s+CLSD\b/i,
  VOLCANIC:   /\bVOLCANIC\s+ASH\b/i,
  NAVAID_US:  /(?:VOR|NDB|DME|RNAV|TACAN).*?(?:U\/S|UNSERVICEABLE|OTS|INOP|UNUSBL|NOT\s+AVBL|UNREL)\b/i,

  // ── Approach minimums / procedure changes ──
  // CAT_II_NA: Cat II or III approach explicitly unavailable → RED
  CAT_II_NA:  /CAT\s*I{2,3}[^A-Z]{0,20}(?:NOT\s+AVBL|NOT\s+AVAILABLE|\bNA\b|SUSPENDED|OTS|U\/S)/i,

  // IAP_CHG: IAP NOTAM with any amendment keyword
  IAP_CHG:    /(?:\bIAP\b|\bILS\b|\bLPV\b|\bLNAV\b|\bRNAV\b|\bRNP\b).*?(?:INCREASED\s+FR\s+\d|\bDA\b.*\/HAT|\bMDA\b.*\/HAT|\bPROC\s+NA\b|NOT\s+AVBL|AMDT\s+\d|\bDA\s+\d|\bMDA\s+\d|LPV\s+DA)/i,
};

/**
 * Wrap a keyword match in a highlight span.
 * @param {string} text   - Full NOTAM text (plain)
 * @param {string} level  - 'red' | 'yellow'
 * @param {RegExp} keyRe  - Pattern whose first match to highlight
 * @returns {string}      - HTML with the match wrapped in a span
 */
function _hlText(text, level, keyRe) {
  const cls = level === 'red' ? 'nt-red' : 'nt-yel';
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if (!keyRe) return escaped;
  return escaped.replace(keyRe, (match) =>
    `<span class="${cls}">${match.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`
  );
}

/**
 * Escape HTML in a string.
 * @param {string} s
 * @returns {string}
 */
function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * Check if a taxiway restriction applies to this aircraft type.
 * Returns true if:
 *   - No specific type/wingspan mentioned (applies to all)
 *   - A wingspan limit is mentioned AND the aircraft exceeds it
 *   - A specific aircraft type list is mentioned AND the aircraft type matches
 *
 * @param {string} notamText - NOTAM body
 * @param {string} acftType  - ICAO type designator e.g. 'B738'
 * @returns {boolean}
 */
function _twyApplies(notamText, acftType) {
  const nu = notamText.toUpperCase();
  // Match wingspan/width limit with optional words between keyword and value
  // Handles: "WS 36M", "WIDTH LTD 36M", "MAX WS 36M", "WINGSPAN 36M", "WIDTH LIMITED TO 36M"
  const wsM = nu.match(/(?:MAX\s+)?WS\s+(\d+(?:\.\d+)?)\s*M\b|WIDTH(?:\s+\w+){0,3}\s+(\d+(?:\.\d+)?)\s*M\b|WINGSP(?:AN)?\s+(?:\w+\s+){0,2}(\d+(?:\.\d+)?)\s*M\b/);
  if (wsM) {
    const limitM = parseFloat(wsM[1] || wsM[2] || wsM[3]);
    const acWs   = getWingspan(acftType);
    if (acWs !== null) {
      return acWs > limitM; // applies if our wingspan exceeds limit
    }
    return true; // limit present but type unknown — be conservative
  }

  // Check explicit type mentions (e.g. "RESTRICTED TO B737 TYPE AND ABOVE")
  const typeMatches = [...nu.matchAll(NM.TWY_TYPE)];
  if (typeMatches.length) {
    // If our type is explicitly mentioned, restriction applies
    const acUpper = (acftType || '').toUpperCase();
    return typeMatches.some(m => acUpper.startsWith(m[0].replace(/[^A-Z0-9]/g,'').slice(0,3)));
  }

  // No type/wingspan qualifier — applies to all
  return true;
}

/**
 * Determine the display slot for a NOTAM given the airport role.
 *
 * Returns:
 *   { slot: number, level: 'red'|'yellow', label: string, keyRe: RegExp|null }
 *
 * ORIG slots 1–7 / DEST|ALT slots 1–8.
 * Slot 99 = skip (not applicable).
 *
 * @param {string} nu       - NOTAM text uppercased
 * @param {string} notamRaw - Original NOTAM text
 * @param {string} role     - 'ORIG' | 'DEST' | string (alt)
 * @param {string} acftType - ICAO type
 * @param {boolean} active  - Is this NOTAM active during the ETA/dep window?
 * @returns {{ slot:number, level:string, label:string, keyRe:RegExp|null }}
 */
function _classifyNotamSlot(nu, notamRaw, role, acftType, active) {
  const isOrig = role === 'ORIG';
  const activeSlotBase = isOrig ? 6 : 7; // "active during period" catch-all slot
  const otherSlot      = isOrig ? 7 : 8; // "all other" catch-all slot

  // ── AD Closed — always RED, always slot 1 ──────────────────────────────
  if (NM.AD_CLSD.test(nu)) {
    return { slot: 1, level: 'red', label: 'AD CLSD', keyRe: NM.CLSD_WORDS };
  }

  // ── Closed Runways (slot 1 both roles) ───────────────────────────────
  if (NM.RWY_CLSD.test(nu)) {
    const rm = nu.match(NM.RWY_ID);
    const rwy = rm ? rm[1].replace(/\s+/g,'') : null;
    return { slot: 1, level: 'red', label: `RWY ${rwy || 'CLSD'} CLSD`, keyRe: NM.CLSD_WORDS, rwy };
  }

  // ── Volcanic ash — always RED, slot 1 priority ────────────────────────
  if (NM.VOLCANIC.test(nu)) {
    return { slot: 1, level: 'red', label: 'VOLCANIC ASH', keyRe: NM.VOLCANIC };
  }

  // ──────── ORIGIN-specific slots ──────────────────────────────────────
  if (isOrig) {
    // Slot 2 — Closed / wingspan-restricted taxiways
    if (NM.TWY_CLSD.test(nu) || (NM.TWY_RESTR.test(nu) && _twyApplies(notamRaw, acftType))) {
      const tm = nu.match(NM.TWY_ID);
      const twy = tm ? tm[1] : 'TWY';
      const isClosed = NM.CLSD_WORDS.test(nu);
      return {
        slot: 2,
        level: isClosed ? 'red' : 'yellow',
        label: `TWY ${twy} ${isClosed ? 'CLSD' : 'RESTR'}`,
        keyRe: isClosed ? NM.CLSD_WORDS : NM.RESTR_WORDS,
      };
    }

    // Slot 3 — SID changes
    if (NM.SID.test(nu)) {
      const sm = nu.match(NM.SID_NAME);
      const sid = sm ? sm[1] : 'SID';
      const isUS = NM.US_WORDS.test(nu);
      return { slot: 3, level: isUS ? 'red' : 'yellow', label: `SID ${sid} CHANGE`, keyRe: isUS ? NM.US_WORDS : NM.RESTR_WORDS };
    }

    // Slot 4 — Approach changes (includes Cat II/III N/A and IAP minimums raises)
    if (NM.CAT_II_NA.test(nu)) {
      const am = nu.match(NM.APCH_NAME);
      const rwy = am ? am[2] : null;
      const apch = am ? `${am[1].trim()} RWY ${am[2]}` : 'APCH';
      return { slot: 4, level: 'red', label: `${apch} CAT II/III N/A`, keyRe: NM.CAT_II_NA, rwy };
    }
    if (NM.GS_US.test(nu)) {
      const rm = nu.match(NM.APCH_RWY);
      const rwy = rm ? rm[1] : null;
      const rwylabel = rwy ? ` RWY ${rwy}` : '';
      return { slot: 4, level: 'red', label: `ILS GS U/S${rwylabel} (LOC ONLY)`, keyRe: NM.US_WORDS, rwy };
    }
    if (NM.APCH_CHG.test(nu) || NM.APCH_MIN.test(nu) || NM.IAP_CHG.test(nu)) {
      const am = nu.match(NM.APCH_NAME);
      const rwy = am ? am[2] : null;
      const apch = am ? `${am[1].trim()} RWY ${am[2]}` : 'APCH';
      return { slot: 4, level: 'yellow', label: `${apch} CHANGE`, keyRe: NM.RESTR_WORDS, rwy };
    }
    if (NM.APCH_TYPE_NA.test(nu)) {
      const rm = nu.match(NM.APCH_RWY);
      const rwy = rm ? rm[1] : null;
      return { slot: 4, level: 'yellow', label: `APCH TYPE CHG${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.RESTR_WORDS, rwy };
    }
    if (NM.ALT_MINS_CHG.test(nu)) {
      const rm = nu.match(NM.APCH_RWY);
      const rwy = rm ? rm[1] : null;
      return { slot: 4, level: 'yellow', label: `ALT MINS CHG${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.RESTR_WORDS, rwy };
    }

    // Slot 5 — Alternate missed approach
    if (NM.ALT_MA.test(nu)) {
      const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i) || nu.match(NM.APCH_RWY);
      const rwy = rm ? rm[1] : null;
      return { slot: 5, level: 'yellow', label: `ALT MA PROC CHANGE${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.RESTR_WORDS, rwy };
    }

    // Slot 6 — Active during departure period / slot 7 — all others
    return { slot: active ? activeSlotBase : otherSlot, level: 'yellow', label: null, keyRe: null };
  }

  // ──────── DEST / ALT slots ────────────────────────────────────────────

  // ── DEST / ALT SLOT 2: Equipment unserviceable — precision guidance lost ─────
  // Priority order within slot 2: CAT II/III → GS → LOC → full APCH → DME → VORTAC

  // Slot 2a — CAT II/III NOT AVBL → RED
  if (NM.CAT_II_NA.test(nu)) {
    const am = nu.match(NM.APCH_NAME);
    const rwy = am ? am[2] : null;
    const apch = am ? `${am[1].trim()} RWY ${am[2]}` : 'APCH';
    return { slot: 2, level: 'red', label: `${apch} CAT II/III N/A`, keyRe: NM.CAT_II_NA, rwy };
  }

  // Slot 2b — Glide slope specifically U/S (ILS → LOC-only)
  if (NM.GS_US.test(nu)) {
    const rm = nu.match(NM.APCH_RWY) || nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    return { slot: 2, level: 'red', label: `ILS GS U/S${rwy ? ' RWY ' + rwy : ''} (LOC ONLY)`, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 2c — Localizer (full word) U/S
  if (NM.LOC_US.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    return { slot: 2, level: 'red', label: `LOC U/S${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 2d — Full approach system U/S (ILS/LOC/RNAV/VOR/NDB/GLS)
  if (NM.APCH_US.test(nu)) {
    const am = nu.match(NM.APCH_NAME);
    const rwy = am ? am[2] : null;
    const apch = am ? `${am[1].trim()} RWY ${am[2]}` : 'APCH';
    return { slot: 2, level: 'red', label: `${apch} U/S`, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 2e — DME U/S — RED for approach DME, YELLOW for en-route DME
  if (NM.DME_US.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    const isApchDme = /ILS\s+DME|APCH\s+DME|APPROACH\s+DME/i.test(nu);
    return { slot: 2, level: isApchDme ? 'red' : 'yellow', label: `DME U/S${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 2f — VORTAC U/S (TACAN DME component)
  if (NM.VORTAC_US.test(nu)) {
    return { slot: 2, level: 'yellow', label: 'VORTAC U/S', keyRe: NM.US_WORDS, rwy: null };
  }

  // ── DEST / ALT SLOT 3: Procedure changes and supporting equipment ─────────

  // Slot 3 — Approach procedure / minimums changes (IAP_CHG covers Atlas OFP format)
  if (NM.APCH_CHG.test(nu) || NM.APCH_MIN.test(nu) || NM.IAP_CHG.test(nu)) {
    const am = nu.match(NM.APCH_NAME);
    const rwy = am ? am[2] : null;
    const apch = am ? `${am[1].trim()} RWY ${am[2]}` : 'APCH';
    return { slot: 3, level: 'yellow', label: `${apch} PROC CHANGE`, keyRe: NM.RESTR_WORDS, rwy };
  }

  // Slot 3b — Approach type degraded (LOC only, CAT I only, precision N/A)
  if (NM.APCH_TYPE_NA.test(nu)) {
    const rm = nu.match(NM.APCH_RWY);
    const rwy = rm ? rm[1] : null;
    return { slot: 3, level: 'yellow', label: `APCH TYPE CHG${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.RESTR_WORDS, rwy };
  }

  // Slot 3c — Alternate minimums changed
  if (NM.ALT_MINS_CHG.test(nu)) {
    const rm = nu.match(NM.APCH_RWY);
    const rwy = rm ? rm[1] : null;
    return { slot: 3, level: 'yellow', label: `ALT MINS CHG${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.RESTR_WORDS, rwy };
  }

  // Slot 3d — Marker beacons U/S (OM/MM/LOM) — DA awareness cue lost
  if (NM.MARKER_US.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    const isOM = /\b(?:OUTER\s+MARKER|LOM|OM)\b/i.test(nu);
    const lbl = isOM ? `OM/LOM U/S${rwy ? ' RWY ' + rwy : ''}` : `MARKER U/S${rwy ? ' RWY ' + rwy : ''}`;
    return { slot: 3, level: 'yellow', label: lbl, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 3e — GPS/GNSS U/S or unreliable — all RNAV/RNP/LPV approaches affected
  // RED: hard outage (U/S, OTS, lost, jamming); YELLOW: degraded/unreliable
  if (NM.GPS_US.test(nu)) {
    const isHard = /\b(?:U\/S|UNSERVICEABLE|OTS|NOT\s+AVBL|LOST|JAMMING|JAM)\b/i.test(nu);
    return { slot: 3, level: isHard ? 'red' : 'yellow',
             label: isHard ? 'GPS/GNSS U/S — RNAV N/A' : 'GPS/GNSS UNRELIABLE',
             keyRe: NM.US_WORDS, rwy: null };
  }

  // Slot 3f — RAIM not available (RNP approaches require predictive RAIM)
  if (NM.RAIM_NA.test(nu)) {
    return { slot: 3, level: 'yellow', label: 'RAIM NOT AVBL (RNP N/A)', keyRe: NM.RESTR_WORDS, rwy: null };
  }

  // Slot 3g — Approach lighting U/S — directly raises published MDA/DA
  // RED: primary ALS (ALSF-1/2, MALSR, SSALR) — large minima increase
  // YELLOW: supplemental (MALS, REIL, ODALS) — minor impact
  if (NM.ALS_US.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    const isPrimary = /ALSF|MALSR|SSALR|SSALF/i.test(nu);
    return { slot: 3, level: isPrimary ? 'red' : 'yellow', label: `ALS U/S${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 3h — PAPI/VASI U/S — visual glide path reference lost
  if (NM.PAPI_US.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    return { slot: 3, level: 'yellow', label: `PAPI/VASI U/S${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 3i — REIL U/S — runway end identifier lights
  if (NM.REIL_US.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    return { slot: 3, level: 'yellow', label: `REIL U/S${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 3j — Runway centerline lights U/S — Cat II/III and low-vis ops requirement
  if (NM.RCLL_US.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    return { slot: 3, level: 'yellow', label: `RCLL U/S${rwy ? ' RWY ' + rwy : ''} (CAT II/III IMPACT)`, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 3k — Touchdown zone lights U/S — Cat II/III requirement
  if (NM.TDZ_US.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    return { slot: 3, level: 'yellow', label: `TDZ LGTS U/S${rwy ? ' RWY ' + rwy : ''} (CAT II/III IMPACT)`, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 3l — HIRL/MIRL runway edge lights U/S
  if (NM.RWY_LGTS_US.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    return { slot: 3, level: 'yellow', label: `RWY LGTS U/S${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.US_WORDS, rwy };
  }

  // Slot 3m — Displaced threshold — affects LDA and approach minima
  if (NM.DSPLCD_THR.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i);
    const rwy = rm ? rm[1] : null;
    return { slot: 3, level: 'yellow', label: `DSPLCD THR${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.RESTR_WORDS, rwy };
  }

  // ── DEST / ALT SLOT 4: Alternate missed approach ──────────────────────────
  if (NM.ALT_MA.test(nu)) {
    const rm = nu.match(/RWY\s+(\d{2}[LCRB]?)/i) || nu.match(NM.APCH_RWY);
    const rwy = rm ? rm[1] : null;
    return { slot: 4, level: 'yellow', label: `ALT MA PROC CHANGE${rwy ? ' RWY ' + rwy : ''}`, keyRe: NM.RESTR_WORDS, rwy };
  }

  // ── DEST / ALT SLOT 5: STAR changes ──────────────────────────────────────
  if (NM.STAR.test(nu)) {
    const sm = nu.match(NM.STAR_NAME);
    const star = sm ? sm[1] : 'STAR';
    return { slot: 5, level: 'yellow', label: `STAR ${star} CHANGE`, keyRe: NM.RESTR_WORDS, rwy: null };
  }

  // Slot 6 — Closed / wingspan-restricted taxiways
  if (NM.TWY_CLSD.test(nu) || (NM.TWY_RESTR.test(nu) && _twyApplies(notamRaw, acftType))) {
    const tm = nu.match(NM.TWY_ID);
    const twy = tm ? tm[1] : 'TWY';
    const isClosed = NM.CLSD_WORDS.test(nu);
    return {
      slot: 6,
      level: isClosed ? 'red' : 'yellow',
      label: `TWY ${twy} ${isClosed ? 'CLSD' : 'RESTR'}`,
      keyRe: isClosed ? NM.CLSD_WORDS : NM.RESTR_WORDS,
    };
  }

  // Slot 7 — active during period / slot 8 — all other
  return { slot: active ? activeSlotBase : otherSlot, level: 'yellow', label: null, keyRe: null };
}

/**
 * Universal NOTAM evaluator — the core engine for airport card display.
 *
 * @param {string[]} notams        - Individual NOTAM strings (from _splitNotams)
 * @param {string}   role          - 'ORIG' | 'DEST' | 'ALT' | any alternate role
 * @param {number|null} etaMin     - ETA/DEP as minutes-of-day (0–1439), or null
 * @param {string|object} acftType - ICAO type designator e.g. 'B748', OR a full
 *                                   acftProfile object from buildAcftProfile().
 *                                   When a string is passed, buildAcftProfile() is
 *                                   called automatically. Pass the profile object
 *                                   when it has already been built from the OFP.
 * @param {string}   flightDateISO - 'YYYY-MM-DD' for NOTAM window anchoring
 *
 * @returns {{
 *   issues:    Array<{slot,level,text,active,notamRaw,rwy,label}>,
 *   rwyGroups: Map<string, {
 *                rwy:       string|null,
 *                twy:       string|null,
 *                groupType: 'runway'|'taxiway'|'general',
 *                worst:     string,
 *                label:     string,
 *                items:     Array<{slot,level,label,shortLabel,text,active,notamRaw}>
 *              }>,
 *   worst:     string
 * }}
 *
 * Group label semantics (groupType = 'runway'):
 *   Single item  → label = short operational label, e.g. "ILS GS U/S"
 *                  (rendered as: "RWY 25L — ILS GS U/S")
 *   Multi items  → label = "N Approach NOTAMs"
 *                  (rendered as: "RWY 25L — 3 Approach NOTAMs")
 *                  Each item in group has shortLabel for the indexed list row.
 *
 * Group label semantics (groupType = 'taxiway'):
 *   Single item  → label = "CLSD" | "RESTR"
 *   Multi items  → label = "N Taxiway NOTAMs"
 */
function evalNotams(notams, role, etaMin, acftType, flightDateISO) {
  if (!notams || !notams.length) {
    return { issues: [], rwyGroups: new Map(), worst: 'unknown' };
  }

  // Build aircraft profile — accepts string or pre-built object
  const acftProfile = (typeof acftType === 'object' && acftType !== null)
    ? acftType
    : buildAcftProfile(acftType || '');

  // Resolve flight date
  const resolvedISO = flightDateISO ||
    (typeof window !== 'undefined' && window._flightDateISO) || null;

  const _prevISO = (typeof window !== 'undefined') ? window._flightDateISO : null;
  if (typeof window !== 'undefined') window._flightDateISO = resolvedISO || window._flightDateISO;

  const isOrig    = role === 'ORIG';
  const seen      = new Set();
  const collected = [];
  let   worst     = 'unknown';

  const _bumpW = (lvl) => {
    const order = { unknown:0, green:1, yellow:2, red:3 };
    if ((order[lvl]||0) > (order[worst]||0)) worst = lvl;
  };

  for (const notamRaw of notams) {
    const nu = notamRaw.toUpperCase();

    // ── Obstacle filter: skip pure obstacle NOTAMs (no approach keyword) ──
    const hasApchKeyword = /\b(?:ILS|LOC|GLS|RNAV|RNP|NDB|VOR|LDA|GBAS|GS|G\/S|G\/P|GP|IFR\s+APCH|IAP|APCH|PROC|RWY|SID|STAR|CAT\s+I{1,3})\b/i.test(notamRaw);
    if (/\bOBST\b|\bCRANE\b|\bOBSTACLE\b/.test(nu) && !hasApchKeyword) continue;

    // ── Aircraft applicability filter ─────────────────────────────────────
    // Only applied when the NOTAM contains an explicit restriction qualifier.
    // If no qualifier is found, _acftApplies returns true (conservative — show it).
    if (!_acftApplies(notamRaw, acftProfile)) continue;

    // ── Active status ─────────────────────────────────────────────────────
    let active = true;
    const w = xNW_standalone(notamRaw, resolvedISO);
    if (w) active = nwOverlap_standalone(w, etaMin, resolvedISO);
    if (active === true && w === null &&
        typeof window !== 'undefined' &&
        typeof xNW === 'function' && typeof nwOverlap === 'function') {
      const wLeg = xNW(notamRaw);
      if (wLeg) active = nwOverlap(wLeg, etaMin);
    }

    const { slot, level, label, keyRe, rwy } =
      _classifyNotamSlot(nu, notamRaw, role, acftProfile.type || '', active);

    // ── Build display text ────────────────────────────────────────────────
    const firstLine = notamRaw.split('\n').find(l => l.trim() && !l.trim().startsWith('-')) || notamRaw;
    const shortLine = firstLine.replace(/^\s*[-–]\s*[A-Z]{4}\s*/,'').trim().slice(0, 120);

    let displayText;
    if (label) {
      const cls = level === 'red' ? 'nt-red' : 'nt-yel';
      displayText = `<span class="${cls}">${_esc(label)}</span>`;
      if (shortLine) displayText += ` — ${_esc(shortLine)}`;
    } else {
      if (keyRe) {
        displayText = _hlText(shortLine, level, keyRe);
      } else {
        const hasRed = NM.CLSD_WORDS.test(nu) || NM.US_WORDS.test(nu);
        const eL = hasRed ? 'red' : level;
        const eR = hasRed ? (NM.CLSD_WORDS.test(nu) ? NM.CLSD_WORDS : NM.US_WORDS) : NM.RESTR_WORDS;
        displayText = _hlText(shortLine, eL, eR);
      }
    }

    const dupKey = `${slot}:${level}:${label||shortLine.slice(0,40)}`;
    if (seen.has(dupKey)) continue;
    seen.add(dupKey);

    // rowLabel: the label shown inside an expanded group row.
    // For humans reading a list of RWY 25L issues, the runway MUST be present
    // on each row — e.g. "ILS GS U/S RWY 25L", "PAPI/VASI U/S RWY 25L".
    // We keep the runway that the classifier already embedded in the label.
    // If no label, fall back to the first line of the NOTAM text.
    const rowLabel = label || shortLine.slice(0, 60);

    collected.push({ slot, level, active, text: displayText, notamRaw,
                     rwy: rwy || null, label: label || null, rowLabel });
    _bumpW(level);
  }

  // Sort: slot ASC, active-first, red before yellow
  const levelRank = { red: 0, yellow: 1, green: 2, unknown: 3 };
  collected.sort((a, b) => {
    if (a.slot !== b.slot)     return a.slot - b.slot;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (levelRank[a.level]||3) - (levelRank[b.level]||3);
  });

  if (!collected.length) {
    collected.push({ slot: 99, level: 'green', active: true,
                     text: '✓ NOTAMs reviewed — no critical items',
                     notamRaw: '', rwy: null, label: null, rowLabel: '✓ No critical items' });
    worst = 'green';
  }
  if (worst === 'unknown') worst = 'green';

  // ── Build rwyGroups map ───────────────────────────────────────────────────
  //
  // Groups are keyed as:
  //   'RWY-06L'   → all approach/navaid/procedure issues for runway 06L
  //   'TAXIWAYS'  → ALL taxiway issues (every TWY ID merged into one group)
  //   'GENERAL'   → approach/procedure issues with no extractable runway
  //
  // Group header label (rendered as the group's title, runway already in text):
  //   Runway group  → "Approach RWY 25L"  (single or multiple items)
  //   Taxiway group → "Taxiway NOTAMs"
  //   General group → "General NOTAMs"
  //
  // Individual item rowLabel always includes the runway/taxiway identifier
  // so crew can read each item unambiguously:
  //   e.g. "ILS GS U/S RWY 25L",  "PAPI/VASI U/S RWY 25L"
  //
  // Items within each group are sorted alphabetically by rowLabel.
  //
  const RUNWAY_SLOTS_DEST = new Set([1, 2, 3, 4]);
  const RUNWAY_SLOTS_ORIG = new Set([1, 4, 5]);
  const TWY_SLOTS         = new Set([2, 6]); // taxiway slots (ORIG=2, DEST=6)
  const runwaySlots = isOrig ? RUNWAY_SLOTS_ORIG : RUNWAY_SLOTS_DEST;

  const rwyGroups = new Map();

  const _addToGroup = (key, groupType, rwy, item) => {
    if (!rwyGroups.has(key)) {
      rwyGroups.set(key, {
        rwy:       rwy   || null,
        groupType,
        worst:     'green',
        label:     '',      // computed after all items collected
        items:     [],
      });
    }
    const grp = rwyGroups.get(key);
    grp.items.push(item);
    const order = { unknown:0, green:1, yellow:2, red:3 };
    if ((order[item.level]||0) > (order[grp.worst]||0)) grp.worst = item.level;
  };

  for (const item of collected) {
    const isTwySlot = TWY_SLOTS.has(item.slot) && item.label && /^TWY\b/i.test(item.label);
    const isRwySlot = runwaySlots.has(item.slot);

    if (isTwySlot) {
      // ALL taxiway issues → single 'TAXIWAYS' group regardless of TWY ID
      _addToGroup('TAXIWAYS', 'taxiway', null, item);
    } else if (isRwySlot) {
      const key = item.rwy ? `RWY-${item.rwy.replace(/\s/g,'')}` : 'GENERAL';
      _addToGroup(key, item.rwy ? 'runway' : 'general', item.rwy || null, item);
    }
  }

  // ── Sort items within each group alphabetically by rowLabel ──────────────
  for (const grp of rwyGroups.values()) {
    grp.items.sort((a, b) => (a.rowLabel || '').localeCompare(b.rowLabel || ''));
  }

  // ── Compute group header labels ───────────────────────────────────────────
  for (const grp of rwyGroups.values()) {
    const n = grp.items.length;
    if (n === 0) { grp.label = ''; continue; }

    if (grp.groupType === 'taxiway') {
      grp.label = 'Taxiway NOTAMs';
      continue;
    }

    if (grp.groupType === 'general') {
      grp.label = n === 1
        ? (grp.items[0].rowLabel || 'NOTAM')
        : 'General NOTAMs';
      continue;
    }

    // runway group — header always reads "Approach RWY NN"
    // (the runway is already embedded in each item's rowLabel for the expanded list)
    grp.label = grp.rwy ? `Approach RWY ${grp.rwy}` : 'Approach NOTAMs';
  }

  // Restore flight date global
  if (typeof window !== 'undefined' && _prevISO !== null) window._flightDateISO = _prevISO;

  return { issues: collected, rwyGroups, worst };
}

// ═══════════════════════════════════════════════════════════════
// UNIVERSAL MODULE EXPORTS
// Relief Pilot v1.9.0 — ESM + CJS + Browser global
// ═══════════════════════════════════════════════════════════════

const _notamExports = {
  // Ruleset schema contract
  RULESET_TYPE:    'notam',
  RULESET_VERSION: '1.9.0',
  SCHEMA_VERSION:  2,
  RULESET_SOURCE:  'FAA AIP GEN 3.1 §5; ICAO Doc 4444 Appendix 6',
  // NOTAM classification
  NOTAM_CLASSES, NOTAM_ACTIONS, NOTAM_ITEMS, QCODE_STRUCTURE,
  // Q-code
  QCODE_SUBJECTS, QCODE_CONDITIONS, interpretQCode,
  // Parsing
  parseNotam, parseNotamTime, notamTimeToDate,
  classifyNotam, extractNotamKeywords, deriveOperationalImpact,
  // Active status
  isNotamActive,
  // Schedule
  SCHEDULE_PATTERNS, decodeNotamSchedule, isActiveInSchedule,
  // Time
  US_TIMEZONES, convertUtcToLocal,
  // Airport timezone
  AIRPORT_TIMEZONES, getAirportTimezone, airportLocalTime,
  // Universal NOTAM evaluation engine (§ 10)
  AIRCRAFT_DATA, AIRCRAFT_WINGSPAN, NM, getWingspan,
  buildAcftProfile, _acftApplies, _twyApplies,
  evalNotams, _classifyNotamSlot, _hlText,
  // Standalone UTC window helpers (§ 6a)
  xNW_standalone, nwOverlap_standalone,
  _parseDateToken, _resolveInlineDateRange,
};

// CJS / Node
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = _notamExports;
}
// AMD
if (typeof define === 'function' && define.amd) {
  define(function() { return _notamExports; });
}
// Browser global
if (typeof window !== 'undefined') {
  window.NotamRules = _notamExports;
}

// ES module named exports: import this file with type="module" or use window.NotamRules / require()