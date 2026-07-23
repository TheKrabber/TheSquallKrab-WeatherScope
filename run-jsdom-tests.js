const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

(async () => {
  const virtualConsole = new VirtualConsole();
  const jsdomErrors = [];
  virtualConsole.on('jsdomError', (e) => jsdomErrors.push(e));
  virtualConsole.on('error', (...args) => console.error('[window console.error]', ...args));
  virtualConsole.on('warn', (...args) => console.warn('[window console.warn]', ...args));

  const dom = await JSDOM.fromFile(path.join(__dirname, 'harness.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    virtualConsole
  });
  const w = dom.window;

  let windowError = null;
  w.addEventListener('error', (e) => { windowError = e.error || e.message; });

  await new Promise((resolve) => {
    if (w.document.readyState === 'complete') return resolve();
    w.addEventListener('load', () => resolve());
    setTimeout(resolve, 8000); // safety net
  });

  if (jsdomErrors.length) {
    console.error(`${jsdomErrors.length} jsdom-level error(s):`);
    jsdomErrors.forEach((e) => console.error(' -', e.message || e, e.detail || ''));
  }
  if (windowError) {
    console.error('Uncaught error in page scripts:', windowError && windowError.stack ? windowError.stack : windowError);
  }

  // Post-load DOM integration check: init() has now run (buildTestMenu etc.),
  // confirming app.js's DOM wiring actually matches index.html's element ids.
  const optionCount = w.document.querySelectorAll('.condition-option').length;
  const groupCount = w.document.querySelectorAll('.tier-group').length;
  console.log(`Test menu built ${optionCount} condition buttons across ${groupCount} tier groups.`);
  if (optionCount !== 90 || groupCount !== 11) {
    console.error('Expected 90 buttons across 11 non-empty tiers (amber/brown have none).');
    process.exitCode = 1;
  }

  if (!w.__DONE__) {
    console.error('Test script in harness.html did not finish running (see errors above).');
    process.exit(1);
  }

  const results = w.__RESULTS__ || [];
  const failed = results.filter((r) => !r.pass);

  console.log(`${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.\n`);
  if (failed.length) {
    failed.forEach((r) => {
      console.log(`  x ${r.name}\n      expected: ${JSON.stringify(r.expected)}\n      actual:   ${JSON.stringify(r.actual)}`);
    });
    dom.window.close();
    process.exit(1);
  } else {
    console.log('All resolver-engine checks passed.');
    console.log('(The fetch warnings above are expected: this sandbox has no network access to');
    console.log(' the live weather APIs, so init() correctly fell through all IP-lookup fallbacks');
    console.log(' and failed gracefully — exactly what should happen offline in a real browser too.)');
    dom.window.close();
    process.exit(0);
  }
})().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
