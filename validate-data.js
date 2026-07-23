// Quick integrity check for weatherData.js. Run with: node test/validate-data.js
const path = require('path');
const { WEATHER_TIERS, WEATHER_CONDITIONS, CONDITIONS_BY_ID, TIER_ORDER } =
  require(path.join(__dirname, '..', 'weatherData.js'));

const VALID_EFFECTS = new Set([
  'sky', 'fog', 'rain', 'snow', 'hail', 'sleet', 'thunder', 'wind', 'dust',
  'smoke', 'ash', 'heat', 'cold', 'flood', 'tornado', 'hurricane', 'multi'
]);
const VALID_SOURCES = new Set(['live', 'approx', 'live-us', 'manual']);
const HEX_RE = /^#[0-9A-F]{6}$/i;

let errors = [];
let warnings = [];

// --- Tiers ---
Object.entries(WEATHER_TIERS).forEach(([key, t]) => {
  if (!HEX_RE.test(t.color)) errors.push(`Tier ${key}: bad color "${t.color}"`);
  if (typeof t.flashing !== 'boolean') errors.push(`Tier ${key}: flashing must be boolean`);
  if (!TIER_ORDER.includes(key)) errors.push(`Tier ${key}: missing from TIER_ORDER`);
});
if (TIER_ORDER.length !== Object.keys(WEATHER_TIERS).length) {
  errors.push('TIER_ORDER length does not match WEATHER_TIERS key count');
}

// --- Conditions ---
const seenIds = new Set();
const tierCounts = {};
WEATHER_CONDITIONS.forEach((c, i) => {
  const where = `#${i} (${c.id || 'NO ID'})`;

  if (!c.id || !/^[a-z0-9_]+$/.test(c.id)) errors.push(`${where}: bad id`);
  if (seenIds.has(c.id)) errors.push(`${where}: duplicate id`);
  seenIds.add(c.id);

  if (!WEATHER_TIERS[c.tier]) errors.push(`${where}: unknown tier "${c.tier}"`);
  tierCounts[c.tier] = (tierCounts[c.tier] || 0) + 1;

  if (!VALID_SOURCES.has(c.source)) errors.push(`${where}: bad source "${c.source}"`);
  if (!VALID_EFFECTS.has(c.effect)) errors.push(`${where}: unknown effect "${c.effect}"`);

  if (typeof c.intensity !== 'number' || c.intensity < 1 || c.intensity > 6) {
    errors.push(`${where}: intensity out of range (${c.intensity})`);
  }

  if (!c.title || !c.title.trim()) errors.push(`${where}: missing title`);
  if (!c.description || !c.description.trim()) errors.push(`${where}: missing description`);

  if (/\bYour Experiencing\b/.test(c.title)) {
    errors.push(`${where}: title still has the "Your Experiencing" typo`);
  }
  if (/\bA [AEIOU]/.test(c.title)) {
    warnings.push(`${where}: possible "a/an" slip in title: "${c.title}"`);
  }
  if (c.title.length > 60) warnings.push(`${where}: long title (${c.title.length} chars)`);
  if (c.description.length > 220) warnings.push(`${where}: long description (${c.description.length} chars)`);

  if (c.icy !== undefined && typeof c.icy !== 'boolean') errors.push(`${where}: icy must be boolean`);
  if (c.windOverlay !== undefined && typeof c.windOverlay !== 'boolean') errors.push(`${where}: windOverlay must be boolean`);

  if (!CONDITIONS_BY_ID[c.id]) errors.push(`${where}: not found in CONDITIONS_BY_ID lookup`);
});

console.log(`Total conditions: ${WEATHER_CONDITIONS.length}`);
console.log('Per tier:', tierCounts);
console.log(`Tiers with zero conditions: ${Object.keys(WEATHER_TIERS).filter(t => !tierCounts[t]).join(', ') || 'none'}`);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach(w => console.log('  ! ' + w));
}

if (errors.length) {
  console.log(`\n${errors.length} ERROR(S):`);
  errors.forEach(e => console.log('  x ' + e));
  process.exit(1);
} else {
  console.log('\nAll checks passed.');
}
