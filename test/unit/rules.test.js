'use strict';
// Runs the module test batteries in test/rules/ under `npm test` (node --test "test/unit/*.test.js"),
// so CI runs them on every pull request. Each battery registers its own tests.
require('../rules/notam-rules.test.js');
require('../rules/ofp-navblue.test.js');
require('../rules/aircraft-profile.test.js');
require('../rules/notam-aircraft.test.js');
