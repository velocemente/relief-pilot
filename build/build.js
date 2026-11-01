/**
 * build/build.js — assembles src/ fragments into dist/index.html
 *
 * Usage:
 *   node build/build.js
 *
 * Output: dist/index.html
 *
 * The concatenated output must be byte-for-byte identical to the committed
 * index.html.  CI verifies this with a sha256 hash comparison.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT     = path.join(OUT_DIR, 'index.html');

// Modules listed in the exact order they appear in the assembled file.
const MODULES = [
  'styles.html',
  'screens.html',
  'weather.html',
  'notam.html',
  'nat.html',
  'state.html',
  'storage.html',
  'pdf.html',
  'ofp-parse.html',
  'render-preflight.html',
  'render-enroute.html',
  'rest.html',
  'render-descent.html',
  'edit.html',
  'airports.html',
  'oei.html',
  'copy.html',
  'import.html',
  'settings.html',
  'sw-register.html',
];

// Engine modules to be inlined. Order matters: dependencies first.
const ENGINE_MODULES = [
  'src/import/registry.js',
  'src/import/detector.js',
  'src/import/notam-record.js',
  'src/import/adapter-pdf.js',
  'src/import/atlas-fk.js',
  'src/import/validate.js',
  'src/import/legacy-shape.js',
];

function buildEngineScript() {
  const engines = {};

  // Read all engine files first
  for (const file of ENGINE_MODULES) {
    const filePath = path.join(ROOT, file);
    engines[file] = fs.readFileSync(filePath, 'utf8');
  }

  // Build the script with a simple module system
  let script = '(function() {\n';
  script += "  'use strict';\n";
  script += '  const modules = {};\n\n';

  // Helper function for require that handles './module.js' style paths
  script += '  function require(id) {\n';
  script += '    // Convert "./registry.js" to "registry"\n';
  script += '    const moduleId = id.replace(/^\\.\\\//, "").replace(/\\.js$/, "");\n';
  script += '    return modules[moduleId];\n';
  script += '  }\n\n';

  // Define each module by executing it in a closure
  for (const file of ENGINE_MODULES) {
    const code = engines[file];
    const moduleId = path.basename(file, '.js');

    // Remove the module.exports line and 'use strict'
    let moduleCode = code.replace(/^'use strict';\n/m, '').trim();
    const exportsMatch = moduleCode.match(/module\.exports\s*=\s*(.+);?\s*$/s);

    if (!exportsMatch) {
      throw new Error(`No module.exports found in ${file}`);
    }

    // Extract exports object and remove the module.exports line
    const exportsExpr = exportsMatch[1].replace(/;\s*$/, '');
    moduleCode = moduleCode.substring(0, exportsMatch.index).trim();

    script += `  // ─── ${moduleId}.js ───\n`;
    script += `  (() => {\n`;
    script += '    const module = { exports: {} };\n';
    script += '    ' + moduleCode.split('\n').join('\n    ') + '\n';
    script += `    modules['${moduleId}'] = ${exportsExpr};\n`;
    script += '  })();\n\n';
  }

  // Export the public API
  script += '  window.PB_IMPORT = {\n';
  script += "    detect: modules.detector.detect,\n";
  script += "    extractCbm: modules['atlas-fk'].extractCbm,\n";
  script += "    validate: modules.validate.validate,\n";
  script += "    toLegacyShape: modules['legacy-shape'].toLegacyShape,\n";
  script += "    REGISTRY: modules.registry.REGISTRY,\n";
  script += '  };\n';
  script += '})();\n';

  return Buffer.from(script, 'utf8');
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// Build the engine script
const engineScript = buildEngineScript();

// Read HTML modules
const htmlParts = [];
for (let i = 0; i < MODULES.length; i++) {
  const name = MODULES[i];
  if (name === 'ofp-parse.html') {
    // Insert engine code before ofp-parse.html (without script tags — we're already in one)
    htmlParts.push(engineScript);
  }
  htmlParts.push(fs.readFileSync(path.join(SRC_DIR, name)));
}

const assembled = Buffer.concat(htmlParts);
fs.writeFileSync(OUT, assembled);

const totalBytes = assembled.length;
const kb = (totalBytes / 1024).toFixed(1);
console.log(`Built ${OUT} (${MODULES.length} HTML modules + engine, ${kb} KB)`);
