/**
 * wx-rules.js — Weather Interpretation Ruleset
 * Relief Pilot v1.9.0
 * ─────────────────────────────────────────────
 * Standalone universal module — works as:
 *   • ES module:   import { parseMetar, parseTaf } from './wx-rules.js'
 *   • CommonJS:    const wx = require('./wx-rules.js')
 *   • Browser tag: <script src="wx-rules.js"></script>  → window.WxRules
 *
 * Sources:
 *   FAA AIP GEN 2.1  — Measuring System & Time System
 *   FAA AIP GEN 2.2  — Abbreviations used in AIS publications
 *   FAA AIP GEN 3.5  — Meteorological Services (METAR, SPECI, TAF, products)
 *   ICAO Doc 4444    — PANS-ATM (phraseology, SIGMET/AIRMET classification)
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// § 1 · UNIT & MEASUREMENT STANDARDS
//       Source: FAA AIP GEN 2.1 TBL GEN 2.1-1
// ═══════════════════════════════════════════════════════════════

const UNITS = {
  distance:      'nautical miles (tenths)',
  shortDistance: 'feet',
  altitude:      'feet MSL',
  speed:         'knots',
  verticalSpeed: 'feet per minute',
  windDirLanding:'degrees magnetic',
  windDirEnRoute:'degrees true',
  visibility:    'statute miles or feet',
  altimeter:     'inches of mercury (inHg)',
  temperature:   'degrees Fahrenheit',
  weight:        'pounds',
  time:          'UTC (Zulu)',
};

function metersToStatuteMiles(meters) { return meters / 1609.344; }
function feetToMeters(feet)           { return feet * 0.3048; }
function celsiusToFahrenheit(celsius) { return (celsius * 9 / 5) + 32; }
function hpaToInhg(hpa)               { return hpa * 0.02953; }
function kmToSm(km)                   { return km * 0.6213712; }

// ═══════════════════════════════════════════════════════════════
// § 2 · TIME SYSTEM
//       Source: FAA AIP GEN 2.1 §2; ICAO Doc 4444 §3.6
// ═══════════════════════════════════════════════════════════════

const US_TIMEZONES = {
  'AST': -4, 'EST': -5, 'CST': -6, 'MST': -7, 'PST': -8, 'AKST': -9, 'HST': -10,
  'ADT': -3, 'EDT': -4, 'CDT': -5, 'MDT': -6, 'PDT': -7, 'AKDT': -8,
  'Z': 0,'A':-1,'B':-2,'C':-3,'D':-4,'E':-5,'F':-6,'G':-7,'H':-8,'I':-9,
  'K':-10,'L':-11,'M':-12,'N':1,'O':2,'P':3,'Q':4,'R':5,'S':6,'T':7,'U':8,'V':9,'W':10,'X':11,'Y':12,
};

function convertUtcToLocal(utcTime, tzOrOffset) {
  let offsetHours;
  if (typeof tzOrOffset === 'number') {
    offsetHours = tzOrOffset;
  } else {
    const tz = tzOrOffset.toUpperCase();
    if (!(tz in US_TIMEZONES)) throw new Error(`Unknown timezone: ${tzOrOffset}`);
    offsetHours = US_TIMEZONES[tz];
  }
  let hours, minutes;
  if (/^\d{4}$/.test(utcTime)) {
    hours = parseInt(utcTime.slice(0, 2), 10);
    minutes = parseInt(utcTime.slice(2, 4), 10);
  } else {
    const d = new Date(utcTime);
    hours = d.getUTCHours();
    minutes = d.getUTCMinutes();
  }
  const localHours = (hours + offsetHours + 48) % 24;
  const dayShift = Math.floor((hours + offsetHours) / 24);
  const localStr = String(localHours).padStart(2, '0') + String(minutes).padStart(2, '0');
  const tzAbbr = typeof tzOrOffset === 'string' ? tzOrOffset.toUpperCase() : `UTC${offsetHours >= 0 ? '+' : ''}${offsetHours}`;
  return { local: localStr, tzAbbr, utcOffset: offsetHours, dayShift, display: `${localStr} ${tzAbbr}` };
}

// ═══════════════════════════════════════════════════════════════
// § 3 · METAR / SPECI PARSING
//       Source: FAA AIP GEN 3.5 §3.5.2; ICAO Doc 4444 App 2
// ═══════════════════════════════════════════════════════════════

const SPECI_CRITERIA = [
  { id:1,  category:'Wind Shift',              rule:'Wind direction changes ≥45° in <15 min with wind speed ≥10 kt throughout.' },
  { id:2,  category:'Visibility',              rule:'Visibility crosses: 3SM, 2SM, 1SM, ½SM, ¼SM, or lowest IAP minimum (either direction).' },
  { id:3,  category:'RVR',                     rule:'Highest RVR on designated runway crosses 2,400 ft threshold (either direction) in preceding 10 min.' },
  { id:4,  category:'Tornado/Funnel Cloud',    rule:'Observed, OR disappears from sight / ends.' },
  { id:5,  category:'Thunderstorm',            rule:'Begins (if none currently reported), or ends.' },
  { id:6,  category:'Precipitation',           rule:'Hail begins/ends; freezing precip begins/ends/changes intensity; ice pellets begin/end/change; snow begins/ends/changes intensity.' },
  { id:7,  category:'Squall',                  rule:'Wind suddenly increases ≥16 kt and sustains ≥22 kt for ≥1 minute.' },
  { id:8,  category:'Ceiling',                 rule:'Ceiling forms, dissipates below, decreases to <, or increases to ≥: 3000ft, 1500ft, 1000ft, 500ft, or lowest IAP minimum.' },
  { id:9,  category:'Sky Condition',           rule:'A layer/obscuration appears below 1000ft when none was reported below 1000ft in preceding METAR/SPECI.' },
  { id:10, category:'Volcanic Eruption',       rule:'When eruption is first noted.' },
  { id:11, category:'Aircraft Mishap',         rule:'Upon notification, unless an intervening observation has been made.' },
  { id:12, category:'Miscellaneous',           rule:'Any other critical meteorological situation designated by the responsible agency.' },
];

const SKY_COVER = {
  SKC: { coverage:0,    label:'Sky Clear',          oktas:'0/8' },
  CLR: { coverage:0,    label:'Clear (auto)',        oktas:'0/8' },
  FEW: { coverage:0.25, label:'Few',                 oktas:'1-2/8' },
  SCT: { coverage:0.50, label:'Scattered',           oktas:'3-4/8' },
  BKN: { coverage:0.75, label:'Broken (ceiling)',    oktas:'5-7/8' },
  OVC: { coverage:1.00, label:'Overcast (ceiling)',  oktas:'8/8' },
  VV:  { coverage:1.00, label:'Vertical Visibility', oktas:'8/8' },
};

const WX_PHENOMENA = {
  '-':'Light','+':'Heavy','VC':'In Vicinity',
  'MI':'Shallow','PR':'Partial','BC':'Patches','DR':'Drifting','BL':'Blowing',
  'SH':'Showers','TS':'Thunderstorm','FZ':'Freezing','RE':'Recent',
  'RA':'Rain','DZ':'Drizzle','SN':'Snow','SG':'Snow Grains','IC':'Ice Crystals',
  'PL':'Ice Pellets','GR':'Hail','GS':'Small Hail/Snow Pellets','UP':'Unknown Precip',
  'FG':'Fog','BR':'Mist','HZ':'Haze','FU':'Smoke','DU':'Dust','SA':'Sand',
  'VA':'Volcanic Ash','PY':'Spray','PO':'Dust/Sand Whirls','SQ':'Squall',
  'FC':'Funnel Cloud/Tornado/Waterspout','SS':'Sandstorm','DS':'Dust Storm',
};

function isCeiling(cover) { return ['BKN','OVC','VV'].includes(cover.toUpperCase()); }
function parseTempC(s)    { return s.startsWith('M') ? -parseInt(s.slice(1), 10) : parseInt(s, 10); }

function parseMetar(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Invalid METAR input');
  const tokens = raw.trim().replace(/\s+/g,' ').split(' ');
  const result = {
    raw, type:null, station:null, timeUtc:null, auto:false,
    wind:null, visibility:null, rvr:[], weather:[], skyCondition:[],
    ceiling:null, temperature:null, dewpoint:null, altimeter:null,
    remarks:null, flightCategory:null, warnings:[],
  };
  let i = 0;
  if (tokens[i]==='METAR'||tokens[i]==='SPECI') result.type=tokens[i++];
  if (tokens[i]==='COR') i++;
  if (/^[A-Z]{4}$/.test(tokens[i])) result.station=tokens[i++];
  if (/^\d{6}Z$/.test(tokens[i])) result.timeUtc=tokens[i++];
  if (tokens[i]==='AUTO') { result.auto=true; i++; }
  const windRe = /^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?KT$/;
  if (i<tokens.length && windRe.test(tokens[i])) {
    const m=tokens[i].match(windRe);
    result.wind={ raw:tokens[i], direction:m[1]==='VRB'?'Variable':parseInt(m[1],10), speed:parseInt(m[2],10), gust:m[4]?parseInt(m[4],10):null, unit:'KT' };
    i++;
    if (/^\d{3}V\d{3}$/.test(tokens[i])) {
      const p=tokens[i].split('V');
      result.wind.variableFrom=parseInt(p[0],10); result.wind.variableTo=parseInt(p[1],10); i++;
    }
  }
  const visRe2=/^M?(\d+)(\/(\d+))?SM$/;
  if (i<tokens.length && visRe2.test(tokens[i])) {
    const rv=tokens[i]; const less=rv.startsWith('M');
    const m=rv.replace('M','').match(/^(\d+)(\/(\d+))?SM$/);
    let sm=m?parseFloat(m[1])/(m[3]?parseFloat(m[3]):1):null;
    if (sm!==null && i+1<tokens.length && /^\d+\/\d+SM$/.test(tokens[i+1])) {
      const fr=tokens[i+1].match(/^(\d+)\/(\d+)SM$/); sm+=parseFloat(fr[1])/parseFloat(fr[2]); i++;
    }
    result.visibility={raw:rv,sm,lessThan:less}; i++;
  } else if (/^\d{4}$/.test(tokens[i])&&parseInt(tokens[i],10)<=9999) {
    const meters=parseInt(tokens[i],10);
    result.visibility={raw:tokens[i],meters,sm:metersToStatuteMiles(meters)}; i++;
  }
  while (i<tokens.length && /^R\d{2}[LCR]?\//.test(tokens[i])) { result.rvr.push({raw:tokens[i]}); i++; }
  while (i<tokens.length && /^[\-\+]?(VC)?[A-Z]{2,6}$/.test(tokens[i])
      && !tokens[i].match(/^(FEW|SCT|BKN|OVC|VV|SKC|CLR|NSC|NCD)/)
      && tokens[i]!=='TEMPO' && tokens[i]!=='BECMG') { result.weather.push(tokens[i]); i++; }
  while (i<tokens.length) {
    const skyRe=/^(FEW|SCT|BKN|OVC|SKC|CLR|NSC|NCD|VV)(\d{3})?(?:\/(CB|TCU))?$/;
    if (!skyRe.test(tokens[i])) break;
    const m=tokens[i].match(skyRe);
    const layer={raw:tokens[i],cover:m[1],height:m[2]?parseInt(m[2],10)*100:null,cb:m[3]||null};
    result.skyCondition.push(layer);
    if (isCeiling(layer.cover)&&result.ceiling===null&&layer.height!==null) result.ceiling=layer.height;
    i++;
  }
  if (i<tokens.length && /^M?\d+\/M?\d+$/.test(tokens[i])) {
    const p=tokens[i].split('/');
    result.temperature=parseTempC(p[0]); result.dewpoint=parseTempC(p[1]); i++;
  }
  if (i<tokens.length && /^[AQ]\d{4}$/.test(tokens[i])) {
    const code=tokens[i];
    if (code[0]==='A') result.altimeter={raw:code,inHg:parseInt(code.slice(1),10)/100,unit:'inHg'};
    else { const hpa=parseInt(code.slice(1),10); result.altimeter={raw:code,hPa:hpa,inHg:parseFloat(hpaToInhg(hpa).toFixed(2)),unit:'hPa'}; }
    i++;
  }
  if (i<tokens.length && tokens[i]==='RMK') result.remarks=tokens.slice(i+1).join(' ');
  result.flightCategory=classifyFlightCategory(result.ceiling,result.visibility?.sm);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// § 4 · AIRPORT STATUS — 3-TIER (Open / Operational / Red)
//       Source: wx-notam-rules-reference.md §4
// ═══════════════════════════════════════════════════════════════

const AIRPORT_STATUS = {
  OPEN:        { color:'green',  label:'OPEN',        ceilMinFt:3000, visMinSm:5 },
  OPERATIONAL: { color:'yellow', label:'OPERATIONAL',  ceilMinFt:1000, visMinSm:3 },
  RED:         { color:'red',    label:'RED',          ceilMaxFt:1000, visMaxSm:3 },
};

function classifyAirportStatus(ceilingFt, visSm) {
  const ceilCat = ceilingFt===null ? 0 : ceilingFt>=3000 ? 0 : ceilingFt>=1000 ? 1 : 2;
  const visCat  = visSm===null     ? 0 : visSm>=5        ? 0 : visSm>=3         ? 1 : 2;
  const worst   = Math.max(ceilCat, visCat);
  const key     = worst===0 ? 'OPEN' : worst===1 ? 'OPERATIONAL' : 'RED';
  return { status:key, color:AIRPORT_STATUS[key].color, label:AIRPORT_STATUS[key].label, ceilCat, visCat };
}

function classifyAirportStatusFromRaw(visRaw, ceilingFt) {
  if (!visRaw) return { ...classifyAirportStatus(ceilingFt,null), visSm:null };
  const v=visRaw.trim().toUpperCase(); let visSm=null;
  if (v==='P6SM'||v==='9999'||v==='9999M') { visSm=7; }
  else if (/^(\d+(?:\.\d+)?)SM$/.test(v)) visSm=parseFloat(v);
  else if (/^(\d)\/(\d+)SM$/.test(v))  { const m=v.match(/^(\d)\/(\d+)SM$/); visSm=parseInt(m[1])/parseInt(m[2]); }
  else if (/^(\d{1,3}(?:\.\d)?)KM$/.test(v)) { visSm=kmToSm(parseFloat(v.replace('KM',''))); }
  else if (/^\d{4}$/.test(v)) { visSm=metersToStatuteMiles(parseInt(v,10)); }
  return { ...classifyAirportStatus(ceilingFt,visSm), visSm };
}

const RVR_THRESHOLDS = { US_FEET:{open:4000,operational:2400}, ICAO_M:{open:1200,operational:730} };
function classifyRvr(valueFt) {
  if (valueFt>=RVR_THRESHOLDS.US_FEET.open) return 'open';
  if (valueFt>=RVR_THRESHOLDS.US_FEET.operational) return 'operational';
  return 'red';
}

// Legacy LIFR/IFR/MVFR/VFR (kept for external compatibility)
const FLIGHT_CATEGORIES = {
  LIFR:{ color:'#FF00FF', label:'Low IFR',            priority:0 },
  IFR: { color:'#FF0000', label:'IFR',                priority:1 },
  MVFR:{ color:'#0000FF', label:'Marginal VFR',       priority:2 },
  VFR: { color:'#00AA00', label:'Visual Flight Rules', priority:3 },
};
function classifyFlightCategory(ceilingFt, visSm) {
  if ((ceilingFt!==null&&ceilingFt<500)||(visSm!==null&&visSm<1))   return 'LIFR';
  if ((ceilingFt!==null&&ceilingFt<1000)||(visSm!==null&&visSm<3))  return 'IFR';
  if ((ceilingFt!==null&&ceilingFt<=3000)||(visSm!==null&&visSm<=5)) return 'MVFR';
  return 'VFR';
}

// ═══════════════════════════════════════════════════════════════
// § 5 · TAF PARSING
//       Source: FAA AIP GEN 3.5 §2.2.3, §3.4.3.3
// ═══════════════════════════════════════════════════════════════

const TAF_CHANGE_INDICATORS = {
  BECMG:'Becoming — gradual change over 2hr period',
  TEMPO:'Temporary — fluctuating conditions, < half the period',
  PROB30:'30% probability of conditions',
  PROB40:'40% probability of conditions',
  FM:'From — rapid change at specified time',
};

function parseTaf(raw) {
  if (!raw||typeof raw!=='string') throw new Error('Invalid TAF input');
  const result = { raw, type:'TAF', station:null, issued:null, valid:null, validFrom:null, validTo:null, amd:false, cor:false, base:null, groups:[] };
  let text=raw.trim().replace(/\s+/g,' ');
  if (text.startsWith('TAF AMD')) { result.amd=true; text=text.replace('TAF AMD','').trim(); }
  else if (text.startsWith('TAF COR')) { result.cor=true; text=text.replace('TAF COR','').trim(); }
  else if (text.startsWith('TAF')) text=text.replace('TAF','').trim();
  const tokens=text.split(' '); let i=0;
  if (/^[A-Z]{4}$/.test(tokens[i])) result.station=tokens[i++];
  if (/^\d{6}Z$/.test(tokens[i])) result.issued=tokens[i++];
  if (/^\d{4}\/\d{4}$/.test(tokens[i])) {
    result.valid=tokens[i]; const[from,to]=tokens[i].split('/');
    result.validFrom={day:parseInt(from.slice(0,2),10),hourZ:parseInt(from.slice(2),10)};
    result.validTo  ={day:parseInt(to.slice(0,2),10),  hourZ:parseInt(to.slice(2),10)};
    i++;
  }
  const INDICATORS=['BECMG','TEMPO','FM','PROB30','PROB40'];
  const segments=[]; let seg=[];
  for(;i<tokens.length;i++) {
    if(INDICATORS.includes(tokens[i])||(tokens[i]==='PROB'&&/^(30|40)$/.test(tokens[i+1]))) {
      if(seg.length) segments.push(seg); seg=[tokens[i]];
      if(tokens[i]==='PROB') seg.push(tokens[++i]);
    } else seg.push(tokens[i]);
  }
  if(seg.length) segments.push(seg);
  segments.forEach((group,idx)=>{
    const parsed=parseTafGroup(group);
    if(idx===0&&!INDICATORS.includes(group[0])) result.base=parsed;
    else result.groups.push(parsed);
  });
  return result;
}

function parseTafGroup(tokens) {
  const group={indicator:null,probability:null,time:null,wind:null,visibility:null,weather:[],skyCondition:[],ceiling:null,flightCategory:null};
  let i=0;
  if(['BECMG','TEMPO','FM','PROB'].includes(tokens[i])) {
    group.indicator=tokens[i++];
    if(group.indicator==='PROB'&&/^(30|40)$/.test(tokens[i])) {
      group.probability=parseInt(tokens[i++],10);
      if(['BECMG','TEMPO'].includes(tokens[i])) group.indicator=tokens[i++];
    }
  }
  if(/^\d{4}\/\d{4}$/.test(tokens[i])||/^\d{6}$/.test(tokens[i])) group.time=tokens[i++];
  const windRe=/^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?KT$/;
  if(i<tokens.length&&windRe.test(tokens[i])) {
    const m=tokens[i].match(windRe);
    group.wind={raw:tokens[i],direction:m[1]==='VRB'?'Variable':parseInt(m[1],10),speed:parseInt(m[2],10),gust:m[4]?parseInt(m[4],10):null,unit:'KT'};
    i++;
  }
  const visRe=/^M?(\d+)(\/(\d+))?SM$/;
  if(i<tokens.length&&visRe.test(tokens[i])) {
    const rv=tokens[i]; const less=rv.startsWith('M');
    const m=rv.replace('M','').match(/^(\d+)(\/(\d+))?SM$/);
    let sm=m?parseFloat(m[1])/(m[3]?parseFloat(m[3]):1):0;
    if(sm<1&&i+1<tokens.length&&/^\d+\/\d+SM$/.test(tokens[i+1])) {
      const fr=tokens[i+1].match(/^(\d+)\/(\d+)SM$/); sm+=parseFloat(fr[1])/parseFloat(fr[2]); i++;
    }
    group.visibility={raw:rv,sm,lessThan:less}; i++;
  }
  while(i<tokens.length&&/^[\-\+]?(VC)?[A-Z]{2,6}$/.test(tokens[i])&&!/^(FEW|SCT|BKN|OVC|VV|SKC|CLR|NSW)/.test(tokens[i])) group.weather.push(tokens[i++]);
  while(i<tokens.length) {
    const skyRe=/^(FEW|SCT|BKN|OVC|SKC|CLR|NSC|NCD|VV)(\d{3})?(?:\/(CB|TCU))?$/;
    if(!skyRe.test(tokens[i])) break;
    const m=tokens[i].match(skyRe);
    const layer={raw:tokens[i],cover:m[1],height:m[2]?parseInt(m[2],10)*100:null,cb:m[3]||null};
    group.skyCondition.push(layer);
    if(isCeiling(layer.cover)&&group.ceiling===null&&layer.height!==null) group.ceiling=layer.height;
    i++;
  }
  group.flightCategory=classifyFlightCategory(group.ceiling,group.visibility?.sm);
  return group;
}

// ═══════════════════════════════════════════════════════════════
// § 6 · SIGMET / AIRMET INTERPRETATION
//       Source: FAA AIP GEN 3.5 §3.2.1; ICAO Doc 4444 §3.6
// ═══════════════════════════════════════════════════════════════

const SIGMET_PHENOMENA = {
  TS:{label:'Thunderstorms',severity:'CRITICAL'}, TSGR:{label:'Thunderstorms w/ Hail',severity:'CRITICAL'},
  SEV:{label:'Severe Icing',severity:'CRITICAL'}, EXTR:{label:'Extreme Turbulence',severity:'CRITICAL'},
  SEV_TURB:{label:'Severe Turbulence',severity:'CRITICAL'}, DS:{label:'Dust Storm',severity:'HIGH'},
  SS:{label:'Sandstorm',severity:'HIGH'}, VA:{label:'Volcanic Ash',severity:'CRITICAL'},
  OBSC_TS:{label:'Obscured Thunderstorms',severity:'CRITICAL'}, EMBD_TS:{label:'Embedded Thunderstorms',severity:'CRITICAL'},
  FRQ_TS:{label:'Frequent Thunderstorms',severity:'CRITICAL'}, SQL_TS:{label:'Squall Line Thunderstorms',severity:'CRITICAL'},
  MOD_ICE:{label:'Moderate Icing',severity:'MODERATE'}, SEV_ICE:{label:'Severe Icing',severity:'CRITICAL'},
  SEV_MTW:{label:'Severe Mountain Wave',severity:'CRITICAL'}, MOD_TURB:{label:'Moderate Turbulence',severity:'MODERATE'},
};

const AIRMET_SERIES = {
  SIERRA:{ phenomena:['IFR conditions','Mountain obscuration'], hazard:'IFR conditions and mountain obscuration', aircraft:'All — particularly VFR pilots' },
  TANGO:{ phenomena:['Moderate turbulence','Low-level wind shear','Strong surface winds (≥30 kt)'], hazard:'Moderate turbulence, wind shear, and strong surface winds', aircraft:'All aircraft — particularly light aircraft' },
  ZULU:{ phenomena:['Moderate icing','Freezing level information'], hazard:'Moderate icing and freezing levels', aircraft:'All aircraft — particularly aircraft not certified for icing' },
};

function interpretAdvisory(raw, type='SIGMET') {
  const result={raw,type,series:null,number:null,validFrom:null,validTo:null,area:null,phenomena:null,flightLevels:null,movement:null,intensity:null,outlook:null,cancelledBy:null,significance:null};
  const sigM=raw.match(/\b([A-Z]+)\s+(\d+)\b/);
  if(sigM){result.series=sigM[1];result.number=parseInt(sigM[2],10);}
  const timeM=raw.match(/VALID\s+(\d{6})\/(\d{6})/i);
  if(timeM){result.validFrom=timeM[1];result.validTo=timeM[2];}
  for(const[key,info] of Object.entries(type==='SIGMET'?SIGMET_PHENOMENA:{})) {
    if(raw.includes(key.replace(/_/g,' '))){result.phenomena=info.label;result.significance=info.severity;break;}
  }
  if(type==='AIRMET'&&result.series){const s=AIRMET_SERIES[result.series.toUpperCase()];if(s){result.phenomena=s.hazard;result.significance='ADVISORY';}}
  const fls=[...raw.matchAll(/FL(\d{3})/g)].map(m=>parseInt(m[1],10)*100);
  if(fls.length>=2) result.flightLevels={from:fls[0],to:fls[1]};
  else if(fls.length===1) result.flightLevels={to:fls[0]};
  return result;
}

const interpretSigmet = (raw) => interpretAdvisory(raw, 'SIGMET');
const interpretAirmet = (raw) => interpretAdvisory(raw, 'AIRMET');

// ═══════════════════════════════════════════════════════════════
// § 7 · PIREP INTERPRETATION
//       Source: FAA AIP GEN 3.5 §3.8.2.4; ICAO Doc 4444
// ═══════════════════════════════════════════════════════════════

const TURBULENCE_INTENSITY = {
  NEG: {label:'Nil',      description:'No turbulence.'},
  SMTH:{label:'Smooth',   description:'No turbulence.'},
  LGHT:{label:'Light',    description:'Slight, erratic changes in altitude/attitude.'},
  MOD: {label:'Moderate', description:'Similar to Light but of greater intensity. Control difficult.'},
  SEV: {label:'Severe',   description:'Large, abrupt changes in altitude/attitude. Momentary loss of control.'},
  EXTRM:{label:'Extreme', description:'Aircraft practically impossible to control. Structural damage possible.'},
};

const ICING_INTENSITY = {
  NEG: {label:'Nil',      description:'No icing.'},
  TRC: {label:'Trace',    description:'Ice barely perceptible. Deicing effective.'},
  LGHT:{label:'Light',    description:'Ice build-up slight. Deicing/anti-icing adequate.'},
  MOD: {label:'Moderate', description:'Ice build-up potentially hazardous. Diversion may be necessary.'},
  SEV: {label:'Severe',   description:'Ice build-up rapid. Deicing/anti-icing ineffective. Immediate diversion necessary.'},
};

function parsePirep(raw) {
  const result={raw,urgent:raw.trim().startsWith('UUA'),location:null,time:null,altitude:null,aircraft:null,skyCover:null,weather:null,temperature:null,wind:null,turbulence:null,icing:null,remarks:null};
  const fields=raw.split('/').map(f=>f.trim());
  for(const field of fields) {
    if(field.startsWith('OV'))       result.location=field.slice(2).trim();
    else if(field.startsWith('TM'))  result.time=field.slice(2).trim();
    else if(field.startsWith('FL'))  result.altitude=field.slice(2).trim();
    else if(field.startsWith('TP'))  result.aircraft=field.slice(2).trim();
    else if(field.startsWith('SK'))  result.skyCover=field.slice(2).trim();
    else if(field.startsWith('WX'))  result.weather=field.slice(2).trim();
    else if(field.startsWith('TA'))  result.temperature=field.slice(2).trim();
    else if(field.startsWith('WV'))  result.wind=field.slice(2).trim();
    else if(field.startsWith('TB'))  { const tb=field.slice(2).trim().toUpperCase(); result.turbulence={raw:tb,info:TURBULENCE_INTENSITY[tb]||TURBULENCE_INTENSITY[tb.split(' ')[0]]||null}; }
    else if(field.startsWith('IC'))  { const ic=field.slice(2).trim().toUpperCase(); result.icing={raw:ic,info:ICING_INTENSITY[ic]||ICING_INTENSITY[ic.split(' ')[0]]||null}; }
    else if(field.startsWith('RM'))  result.remarks=field.slice(2).trim();
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// § 8 · PRODUCT VALIDITY WINDOWS
//       Source: FAA AIP GEN 3.5
// ═══════════════════════════════════════════════════════════════

const PRODUCT_VALIDITY = {
  METAR:  {issuance:'Hourly (H+55 to H+00)', validFor:'1 hour'},
  SPECI:  {issuance:'As conditions require', validFor:'Until next METAR/SPECI'},
  TAF:    {issuance:'00/06/12/18Z',          validFor:'24 or 30 hours'},
  TAF_AMD:{issuance:'As conditions require', validFor:'Remainder of original TAF period'},
  SIGMET: {issuance:'As conditions require', validFor:'Up to 4 hours (convective: up to 2 hours)'},
  AIRMET: {issuance:'00/06/12/18Z (+3hr outlook)', validFor:'6 hours (Sierra/Tango/Zulu)'},
  CWA:    {issuance:'As issued by CWSU',     validFor:'Up to 2 hours'},
  PIREP:  {issuance:'Pilot-reported',        validFor:'1 hour (or as noted)'},
  WINDS_ALOFT:{issuance:'00/06/12/18Z',      validFor:'6–12 hours'},
};

// ═══════════════════════════════════════════════════════════════
// § 9 · ABBREVIATION LOOKUP
//       Source: FAA AIP GEN 2.2
// ═══════════════════════════════════════════════════════════════

const AIS_ABBREVIATIONS = {
  ALSTG:'altimeter setting', ALT:'altitude', ALTM:'altimeter', ALTN:'alternate',
  APCH:'approach', ARPT:'airport', ARR:'arrive/arrival', ATIS:'automatic terminal information service',
  AVBL:'available', BC:'back course', BKN:'broken', BRG:'bearing', CAT:'category',
  CLSD:'closed', CRS:'course', DEP:'depart/departure', DH:'decision height',
  DME:'distance measuring equipment', ETA:'estimated time of arrival', ETE:'estimated time en route',
  FAF:'final approach fix', FL:'flight level', FREQ:'frequency', FSS:'Flight Service Station',
  GS:'glide slope', IAF:'initial approach fix', IAP:'instrument approach procedure',
  IFR:'instrument flight rules', ILS:'instrument landing system', INOP:'inoperative',
  INT:'intersection', MAA:'maximum authorized altitude', MAG:'magnetic',
  MAP:'missed approach point', MDA:'minimum descent altitude', MEA:'minimum en route IFR altitude',
  MIN:'minimum/minute', MOCA:'minimum obstruction clearance altitude', MSL:'mean sea level',
  NAVAID:'navigational aid', NDB:'nondirectional radio beacon', NM:'nautical mile(s)',
  OTS:'out of service', PAR:'precision approach radar', PPR:'prior permission required',
  RVR:'runway visual range', RWY:'runway', SM:'statute mile(s)', TAF:'terminal aerodrome forecast',
  TPA:'traffic pattern altitude', VFR:'visual flight rules', VOR:'VHF omni-directional radio range',
  VSBY:'visibility', WEA:'weather', WPT:'waypoint', Z:'Coordinated Universal Time',
};

function lookupAbbreviation(abbr) {
  return AIS_ABBREVIATIONS[abbr.toUpperCase()] || WX_PHENOMENA[abbr.toUpperCase()] || null;
}

// ═══════════════════════════════════════════════════════════════
// UNIVERSAL MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════

const _wxExports = {
  // Unit conversion
  UNITS, metersToStatuteMiles, feetToMeters, celsiusToFahrenheit, hpaToInhg, kmToSm,
  // Time
  US_TIMEZONES, convertUtcToLocal,
  // METAR/SPECI
  SPECI_CRITERIA, SKY_COVER, WX_PHENOMENA,
  parseMetar, isCeiling, parseTempC,
  // Airport status (3-tier: Open/Operational/Red)
  AIRPORT_STATUS, RVR_THRESHOLDS,
  classifyAirportStatus, classifyAirportStatusFromRaw, classifyRvr,
  // Flight category (legacy LIFR/IFR/MVFR/VFR — kept for external compatibility)
  FLIGHT_CATEGORIES, classifyFlightCategory,
  // TAF
  TAF_CHANGE_INDICATORS, parseTaf,
  // SIGMET/AIRMET
  SIGMET_PHENOMENA, AIRMET_SERIES, interpretSigmet, interpretAirmet,
  // PIREP
  TURBULENCE_INTENSITY, ICING_INTENSITY, parsePirep,
  // Validity windows
  PRODUCT_VALIDITY,
  // Abbreviations
  AIS_ABBREVIATIONS, lookupAbbreviation,
};

// CJS / Node
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = _wxExports;
}
// AMD
if (typeof define === 'function' && define.amd) {
  define(function() { return _wxExports; });
}
// Browser global
if (typeof window !== 'undefined') {
  window.WxRules = _wxExports;
}

// ES module named exports: import this file with type="module" or use window.WxRules / require()