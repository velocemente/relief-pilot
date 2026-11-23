'use strict';
/**
 * test/lib/not-built-in.js — the declared *-next keys (D90, D96): a module PR adds its module under a
 * *-next key, NOT built into index.html, and only its integration PR moves it to its own key and removes
 * the key from this list. The manifest and build checks (TC-174-001 / 002, TC-175-001, TC-176-001,
 * TC-177-041) accept exactly these keys; any other *-next key still fails.
 *
 * Step 5f display (integration PR): ofp-flightkeys v1.1.0 moved to ofp-flightkeys and advisory-rules
 * v1.0.0 to advisory-rules, both built in.
 * DEF-013 integration PR: ofp-flightkeys v1.1.1 moved from ofp-flightkeys-next to ofp-flightkeys, built in.
 * No *-next key is declared.
 */
module.exports = { NOT_BUILT_IN: Object.freeze([]) };
