'use strict';
// Runs the module test batteries in test/rules/ under `npm test` (node --test "test/unit/*.test.js"),
// so CI runs them on every pull request. Each battery registers its own tests.
require('../rules/notam-rules.test.js');
require('../rules/ofp-navblue.test.js');
require('../rules/aircraft-profile.test.js');
require('../rules/notam-aircraft.test.js');
require('../rules/icao-fpl.test.js');
require('../rules/ofp-flightkeys.test.js');
require('../rules/ofp-flightkeys-release.test.js');
require('../rules/ofp-flightkeys-briefing.test.js');
require('../rules/ofp-flightkeys-v040.test.js');
require('../rules/notam-flightkeys.test.js');
require('../rules/notam-obstacle.test.js');
