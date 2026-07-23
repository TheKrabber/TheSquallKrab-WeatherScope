/**
 * app.js
 * ---------------------------------------------------------------------------
 * Everything the site does, in five parts:
 *   1. Config / thresholds
 *   2. Location + data fetching  (BigDataCloud, ipapi.co, ipwho.is, Nominatim,
 *      Open-Meteo, Open-Meteo Air Quality, api.weather.gov)
 *   3. The condition-resolution engine (turns raw numbers into one of the 90
 *      condition ids from weatherData.js)
 *   4. Rendering (banners, the stat strip, and the 17 animation renderers)
 *   5. The test menu + init
 *
 * DATA SOURCES USED (see README.md for the full breakdown + country notes):
 *   - Open-Meteo Forecast API      https://open-meteo.com            (free, no key)
 *   - Open-Meteo Air Quality API   https://open-meteo.com            (free, no key)
 *   - api.weather.gov (NWS)        https://www.weather.gov/documentation/services-web-api
 *                                                                     (free, no key, US + territories only)
 *   - BigDataCloud reverse-geocode-client (IP location, no key, client-side)
 *   - ipapi.co / ipwho.is           (IP location fallbacks, no key)
 *   - OpenStreetMap Nominatim       (ZIP/postal code -> coordinates, no key)
 * ---------------------------------------------------------------------------
 */

'use strict';

/* =============================================================================
   1. CONFIG
   ========================================================================== */

const CONFIG = {
  refreshIntervalMs: 10 * 60 * 1000 // re-check live weather every 10 minutes
};

const NWS_COVERED = ['US', 'PR', 'GU', 'VI', 'AS', 'MP']; // NWS coverage area

const THRESH = {
  wind: { breezy: 13, windy: 19, veryWindy: 26, highWind: 34, highGust: 50, destructiveGust: 58, extremeGust: 75 },
  tempF: { frostMax: 33, hardFreezeMax: 28, extremeHeatMin: 105, extremeColdMax: -20, polarVortexMax: -30 },
  visibilityMi: { denseFogMax: 0.25, fogMax: 1, mistMax: 3, hazeMax: 6 },
  cape: { scattered: 1000, numerous: 2500, strong: 3000, severe: 4000 },
  aqi: { hazeMin: 51, smokeMin: 101, wildfireMin: 201 },
  dustUgm3: { blowing: 100, storm: 500 },
  flashFloodInHr: 1.5,
  pressureDropHpa24h: 24,
  heatWaveF: 95,
  coldWaveF: 5,
  blizzardWindMph: 35,
  blizzardVisMi: 0.25,
  extremeBlizzardWindMph: 50,
  outbreakTornadoCount: 3
};

/* =============================================================================
   2a. DOM references + state
   ========================================================================== */

const el = {
  conditionBanner: document.getElementById('condition-banner'),
  conditionFooter: document.getElementById('condition-footer'),
  weatherBox: document.getElementById('weather-box'),
  effectLayer: document.getElementById('effect-layer'),
  statRain: document.getElementById('stat-rain'),
  statTemp: document.getElementById('stat-temp'),
  statWind: document.getElementById('stat-wind'),
  statPressure: document.getElementById('stat-pressure'),
  statVisibility: document.getElementById('stat-visibility'),
  statUv: document.getElementById('stat-uv'),
  statAqi: document.getElementById('stat-aqi'),
  locationName: document.getElementById('location-name'),
  zipInput: document.getElementById('zip-input'),
  countrySelect: document.getElementById('country-select'),
  zipSubmit: document.getElementById('zip-submit'),
  useIpBtn: document.getElementById('use-ip-btn'),

};

const state = {
  mode: 'live',       // 'live' | 'test'
  activeConditionId: 'clear_skies',
  location: null,      // { lat, lon, label, countryCode, stateCode, source }
  refreshTimer: null
};

let lightningTimer = null;

/* =============================================================================
   2b. Small utilities
   ========================================================================== */

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function pick(arr, i, fallback) { return (i >= 0 && i < arr.length && arr[i] != null) ? arr[i] : fallback; }
function fmtNum(n, digits) { return (n == null || isNaN(n)) ? (0).toFixed(digits) : n.toFixed(digits); }

function hexToRgbString(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return '0,0,0';
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].join(',');
}

function fetchWithTimeout(url, opts, ms) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, ms || 9000);
  const merged = Object.assign({}, opts, { signal: controller.signal });
  return fetch(url, merged).finally(function () { clearTimeout(timer); });
}

function findHourlyIndexAtOrBefore(times, targetIso) {
  const target = new Date(targetIso).getTime();
  let best = -1;
  for (let i = 0; i < times.length; i++) {
    if (new Date(times[i]).getTime() <= target) best = i; else break;
  }
  return best;
}

/* =============================================================================
   3. LOCATION LOOKUP
   ========================================================================== */

async function locateByIP() {
  // 1) BigDataCloud's client-side reverse-geocode endpoint: free, no key, no
  //    rate limit for normal browser use, and falls back to IP-based location
  //    automatically when no GPS coordinates are supplied (which is what we
  //    want here, since the brief asks for IP-based location by default).
  try {
    const res = await fetchWithTimeout(
      'https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en', {}, 8000);
    if (res.ok) {
      const d = await res.json();
      if (d.latitude != null && d.longitude != null) {
        return {
          lat: d.latitude, lon: d.longitude,
          label: [d.city || d.locality, d.principalSubdivision].filter(Boolean).join(', ') || d.countryName || 'your area',
          countryCode: d.countryCode || null,
          stateCode: d.principalSubdivisionCode ? d.principalSubdivisionCode.split('-').pop() : null,
          source: 'BigDataCloud (IP)'
        };
      }
    }
  } catch (e) { console.warn('BigDataCloud IP lookup failed, trying fallback.', e); }

  // 2) ipapi.co fallback
  try {
    const res = await fetchWithTimeout('https://ipapi.co/json/', {}, 8000);
    if (res.ok) {
      const d = await res.json();
      if (d.latitude != null && d.longitude != null && !d.error) {
        return {
          lat: d.latitude, lon: d.longitude,
          label: [d.city, d.region].filter(Boolean).join(', ') || d.country_name || 'your area',
          countryCode: d.country || null,
          stateCode: d.region_code || null,
          source: 'ipapi.co (IP)'
        };
      }
    }
  } catch (e) { console.warn('ipapi.co lookup failed, trying fallback.', e); }

  // 3) ipwho.is fallback (last resort)
  const res = await fetchWithTimeout('https://ipwho.is/', {}, 8000);
  const d = await res.json();
  if (d.latitude == null || d.longitude == null) {
    throw new Error('Could not determine your location from your IP address.');
  }
  return {
    lat: d.latitude, lon: d.longitude,
    label: [d.city, d.region].filter(Boolean).join(', ') || d.country || 'your area',
    countryCode: d.country_code || null,
    stateCode: d.region_code || null,
    source: 'ipwho.is (IP)'
  };
}

async function locateByZip(zip, countryCode) {
  // OpenStreetMap Nominatim: free, HTTPS + CORS enabled, works worldwide
  // wherever OSM has postal-code coverage. Please keep this to one lookup
  // per user click (Nominatim's usage policy caps public use at ~1 req/sec
  // and asks that it not be hit on every keystroke) — see README.
  const url = 'https://nominatim.openstreetmap.org/search?postalcode=' +
    encodeURIComponent(zip) + '&countrycodes=' + encodeURIComponent(countryCode) +
    '&format=jsonv2&addressdetails=1&limit=1';
  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 9000);
  if (!res.ok) throw new Error('Postal code lookup failed (HTTP ' + res.status + ').');
  const results = await res.json();
  if (!results.length) throw new Error('No location found for that postal code and country.');
  const r = results[0];
  const addr = r.address || {};
  return {
    lat: parseFloat(r.lat), lon: parseFloat(r.lon),
    label: [addr.city || addr.town || addr.village || addr.county, addr.state].filter(Boolean).join(', ') ||
      (r.display_name || '').split(',')[0],
    countryCode: (addr.country_code || countryCode || '').toUpperCase(),
    stateCode: addr['ISO3166-2-lvl4'] ? addr['ISO3166-2-lvl4'].split('-').pop() : null,
    source: 'OpenStreetMap Nominatim (postal code)'
  };
}

/* =============================================================================
   4. DATA FETCHING
   ========================================================================== */

async function fetchOpenMeteo(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    current: [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'precipitation', 'rain',
      'showers', 'snowfall', 'weather_code', 'cloud_cover', 'pressure_msl', 'surface_pressure',
      'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'visibility', 'uv_index', 'cape',
      'snow_depth', 'is_day'
    ].join(','),
    hourly: 'pressure_msl',
    daily: 'temperature_2m_max,temperature_2m_min',
    past_days: '2',
    forecast_days: '1',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto'
  });
  const res = await fetchWithTimeout('https://api.open-meteo.com/v1/forecast?' + params.toString(), {}, 10000);
  if (!res.ok) throw new Error('Weather service returned HTTP ' + res.status + '.');
  const data = await res.json();

  // 24-hour pressure trend, for the bomb-cyclone check.
  let pressureDrop24h = null;
  if (data.hourly && data.hourly.time && data.hourly.pressure_msl && data.current) {
    const idxNow = findHourlyIndexAtOrBefore(data.hourly.time, data.current.time);
    const idxThen = idxNow - 24;
    if (idxNow > -1 && idxThen >= 0) {
      const now = data.hourly.pressure_msl[idxNow];
      const then = data.hourly.pressure_msl[idxThen];
      if (typeof now === 'number' && typeof then === 'number') pressureDrop24h = then - now;
    }
  }

  // Consecutive extreme-temperature days ending today (heat-wave / cold-wave
  // approximation — see weatherData.js header for what "approx" means).
  let heatWaveDays = 0, coldWaveDays = 0;
  if (data.daily && data.daily.temperature_2m_max) {
    const maxes = data.daily.temperature_2m_max, mins = data.daily.temperature_2m_min;
    for (let i = maxes.length - 1; i >= 0; i--) {
      if (maxes[i] != null && maxes[i] >= THRESH.heatWaveF) heatWaveDays++; else break;
    }
    for (let i = mins.length - 1; i >= 0; i--) {
      if (mins[i] != null && mins[i] <= THRESH.coldWaveF) coldWaveDays++; else break;
    }
  }

  return { current: data.current, pressureDrop24h: pressureDrop24h, heatWaveDays: heatWaveDays, coldWaveDays: coldWaveDays };
}

async function fetchAirQuality(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    current: 'us_aqi,us_aqi_pm2_5,us_aqi_pm10,dust',
    timezone: 'auto'
  });
  const res = await fetchWithTimeout('https://air-quality-api.open-meteo.com/v1/air-quality?' + params.toString(), {}, 10000);
  if (!res.ok) throw new Error('Air quality service returned HTTP ' + res.status + '.');
  const data = await res.json();
  return data.current || null;
}

function mapNwsAlertToConditionId(feature) {
  const p = feature.properties || {};
  const event = (p.event || '').toLowerCase();
  const desc = ((p.description || '') + ' ' + (p.headline || '')).toLowerCase();
  const params = p.parameters || {};
  const tornadoThreat = (params.tornadoDamageThreat || [])[0];
  const thunderThreat = (params.thunderstormDamageThreat || [])[0];

  if (event.indexOf('tornado warning') !== -1) {
    if (desc.indexOf('tornado emergency') !== -1) return 'tornado_emergency';
    if (tornadoThreat === 'CATASTROPHIC') return 'violent_tornado';
    if (tornadoThreat === 'CONSIDERABLE' || desc.indexOf('particularly dangerous situation') !== -1) return 'strong_tornado';
    return 'weak_tornado';
  }
  if (event.indexOf('severe thunderstorm warning') !== -1) {
    if (/softball|giant hail|4(\.\d+)?\s*inch/.test(desc)) return 'giant_hail';
    if (thunderThreat === 'DESTRUCTIVE') return 'severe_thunderstorms';
    if (/golf ball|baseball|1(\.\d+)?\s*inch/.test(desc)) return 'large_hail';
    if (desc.indexOf('downburst') !== -1) return 'downburst';
    if (desc.indexOf('microburst') !== -1) return 'microburst';
    if (thunderThreat === 'CONSIDERABLE') return 'strong_thunderstorms';
    if (/quarter size|half dollar|ping pong/.test(desc)) return 'small_hail';
    return 'scattered_thunderstorms';
  }
  if (event.indexOf('blizzard warning') !== -1) {
    return /extreme|life-threatening|catastrophic/.test(desc) ? 'extreme_blizzard' : 'blizzard';
  }
  if (event.indexOf('ice storm warning') !== -1) {
    return /catastrophic|extreme|prolonged power/.test(desc) ? 'catastrophic_ice_storm' : 'ice_storm';
  }
  if (event.indexOf('high wind warning') !== -1) return 'high_wind';
  if (event.indexOf('excessive heat warning') !== -1) return 'extreme_heat';
  if (event.indexOf('extreme cold warning') !== -1) return 'extreme_cold';
  if (event.indexOf('flash flood') !== -1) return 'flash_flooding';
  if (event.indexOf('coastal flood warning') !== -1) return 'coastal_flooding';
  if (event.indexOf('flood warning') !== -1) {
    return (desc.indexOf('historic') !== -1 || desc.indexOf('record flood') !== -1) ? 'historic_flooding' : 'river_flooding';
  }
  if (event.indexOf('hurricane warning') !== -1) {
    if (/category\s*5/.test(desc)) return desc.indexOf('landfall') !== -1 ? 'hurricane_cat5_landfall' : 'hurricane_cat5';
    if (/category\s*4/.test(desc)) return 'hurricane_cat4';
    if (/category\s*3/.test(desc)) return 'hurricane_cat3';
    if (/category\s*2/.test(desc)) return 'hurricane_cat2';
    return 'hurricane_cat1';
  }
  if (event.indexOf('tropical storm warning') !== -1) return 'tropical_storm';
  if (event.indexOf('dust storm warning') !== -1) return 'dust_storm';
  if (event.indexOf('dense fog advisory') !== -1) return 'dense_fog';
  if (event.indexOf('freezing fog') !== -1) return 'freezing_fog';
  if (event.indexOf('special marine warning') !== -1 && desc.indexOf('waterspout') !== -1) return 'waterspout';
  if (event.indexOf('special weather statement') !== -1 && desc.indexOf('funnel cloud') !== -1) return 'funnel_cloud';
  return null;
}

async function resolveFromNws(lat, lon) {
  const result = { ids: [], stateCode: null };
  let features;
  try {
    const res = await fetchWithTimeout(
      'https://api.weather.gov/alerts/active?point=' + lat.toFixed(4) + ',' + lon.toFixed(4),
      { headers: { Accept: 'application/geo+json' } }, 8000);
    if (!res.ok) return result;
    const data = await res.json();
    features = data.features || [];
  } catch (e) {
    console.warn('NWS alerts unavailable (expected outside the US):', e.message);
    return result;
  }

  features.forEach(function (f) {
    const id = mapNwsAlertToConditionId(f);
    if (id) result.ids.push(id);
    const geocode = f.properties && f.properties.geocode;
    if (geocode && geocode.UGC && geocode.UGC[0]) result.stateCode = geocode.UGC[0].slice(0, 2);
  });

  const hasTornadoWarning = result.ids.some(function (id) {
    return ['weak_tornado', 'strong_tornado', 'violent_tornado', 'tornado_emergency'].indexOf(id) !== -1;
  });
  const hasHurricane = result.ids.some(function (id) { return id.indexOf('hurricane_cat') === 0; });

  // Bonus check: several concurrent Tornado Warnings across the wider area
  // is a reasonable stand-in for "outbreak" conditions.
  if ((hasTornadoWarning || hasHurricane) && result.stateCode) {
    try {
      const res2 = await fetchWithTimeout(
        'https://api.weather.gov/alerts/active?area=' + result.stateCode,
        { headers: { Accept: 'application/geo+json' } }, 8000);
      if (res2.ok) {
        const data2 = await res2.json();
        const tornadoWarningCount = (data2.features || []).filter(function (f) {
          return ((f.properties && f.properties.event) || '').toLowerCase().indexOf('tornado warning') !== -1;
        }).length;
        if (tornadoWarningCount >= THRESH.outbreakTornadoCount) {
          result.ids.push(hasHurricane ? 'hurricane_tornado_outbreak' : 'tornado_outbreak');
        }
      }
    } catch (e) { /* non-critical — outbreak detection is a bonus, not required */ }
  }

  // Bonus check: two or more distinct top-tier hazards active at once.
  const distinctHigh = {};
  result.ids.forEach(function (id) {
    if (tierRank(CONDITIONS_BY_ID[id].tier) >= tierRank('crimson')) distinctHigh[id] = true;
  });
  if (Object.keys(distinctHigh).length >= 2) result.ids.push('catastrophic_multi_hazard');

  return result;
}

/* =============================================================================
   5. CONDITION RESOLUTION ENGINE
   ========================================================================== */

function resolveSky(cur) {
  if (!cur || cur.cloud_cover == null) return 'clear_skies';
  const cc = cur.cloud_cover;
  if (cc < 10) return 'clear_skies';
  if (cc < 25) return 'mostly_clear';
  if (cc < 40) return 'partly_clear';
  if (cc < 60) return 'partly_cloudy';
  if (cc < 85) return 'mostly_cloudy';
  return 'overcast';
}

function resolveFogFamily(cur, aq) {
  if (!cur) return null;
  const code = cur.weather_code;
  const visMi = cur.visibility != null ? cur.visibility / 1609.34 : null;
  const isFoggy = (code === 45 || code === 48);

  if (isFoggy) {
    const icy = cur.temperature_2m != null && cur.temperature_2m <= 32;
    if (icy) return 'freezing_fog';
    if (visMi == null) return 'fog';
    if (visMi < THRESH.visibilityMi.denseFogMax) return 'dense_fog';
    if (visMi < THRESH.visibilityMi.fogMax) return 'fog';
    return 'mist';
  }

  const precipCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
  if (aq && precipCodes.indexOf(code) === -1) {
    const aqi = aq.us_aqi, pm25 = aq.us_aqi_pm2_5, pm10 = aq.us_aqi_pm10;
    const pm25Dominant = (pm25 != null && pm10 != null) ? pm25 >= pm10 : true;
    if (aqi != null && aqi > 200 && pm25Dominant) return 'wildfire_smoke';
    if (aqi != null && aqi >= THRESH.aqi.smokeMin && pm25Dominant) return 'smoke';
    if (aqi != null && aqi >= THRESH.aqi.hazeMin && (visMi == null || visMi < THRESH.visibilityMi.hazeMax)) return 'haze';
  }
  return null;
}

function resolvePrecipFamily(cur) {
  if (!cur) return null;
  const code = cur.weather_code;
  const feels = cur.apparent_temperature != null ? cur.apparent_temperature : cur.temperature_2m;
  const precipRate = cur.precipitation != null ? cur.precipitation : 0;

  // Marginal winter temperatures: surface temperature alone can't perfectly
  // separate rain / snow / sleet / freezing rain (that really needs a
  // vertical profile), so "winter-adjacent" codes get a temperature nudge
  // toward Sleet or Wintry Mix before falling through to their plain mapping.
  const winterAdjacent = [61, 63, 66, 67, 71, 73, 75, 85, 86].indexOf(code) !== -1;
  if (winterAdjacent && feels != null) {
    if (feels >= 29 && feels <= 33) return 'sleet';
    if (feels > 33 && feels <= 36) return 'wintry_mix';
  }

  switch (code) {
    case 51: return 'sprinkles';
    case 53:
    case 55: return 'drizzle';
    case 56:
    case 57: return 'freezing_drizzle';
    case 61: return 'light_rain';
    case 63:
    case 80:
    case 81: return 'rain';
    case 65:
    case 82: return 'heavy_rain';
    case 66: return 'freezing_rain';
    case 67: return 'heavy_freezing_rain';
    case 71: return 'light_snow';
    case 73:
    case 85: return 'snow';
    case 75:
    case 86: return 'heavy_snow';
    case 77: return precipRate >= 0.3 ? 'heavy_graupel' : 'graupel';
    default: return null;
  }
}

function resolveThunderFamily(cur) {
  if (!cur) return null;
  const code = cur.weather_code;
  if (code !== 95 && code !== 96 && code !== 99) return null;
  const cape = cur.cape || 0;
  if (code === 99 || cape >= THRESH.cape.severe) return 'severe_thunderstorms';
  if (code === 96 || cape >= THRESH.cape.strong) return 'strong_thunderstorms';
  if (cape >= THRESH.cape.numerous) return 'numerous_thunderstorms';
  if (cape >= THRESH.cape.scattered) return 'scattered_thunderstorms';
  return 'isolated_thunderstorms';
}

function resolveWindFamily(cur) {
  if (!cur || cur.wind_speed_10m == null) return null;
  const sustained = cur.wind_speed_10m;
  const gust = cur.wind_gusts_10m != null ? cur.wind_gusts_10m : sustained;
  const isStorming = [95, 96, 99].indexOf(cur.weather_code) !== -1;

  if (gust >= THRESH.wind.extremeGust) return isStorming ? 'severe_thunderstorms' : 'windstorm';
  if (gust >= THRESH.wind.destructiveGust) return isStorming ? 'damaging_winds' : 'windstorm';
  if (sustained >= THRESH.wind.highWind || gust >= THRESH.wind.highGust) return 'high_wind';
  if (sustained >= THRESH.wind.veryWindy) return 'very_windy';
  if (sustained >= THRESH.wind.windy) return 'windy';
  if (sustained >= THRESH.wind.breezy) return 'breezy';
  return null;
}

function resolveTempExtremes(cur) {
  if (!cur) return null;
  const feels = cur.apparent_temperature != null ? cur.apparent_temperature : cur.temperature_2m;
  if (feels == null) return null;
  if (feels <= THRESH.tempF.polarVortexMax) return 'polar_vortex';
  if (feels <= THRESH.tempF.extremeColdMax) return 'extreme_cold';
  if (feels >= THRESH.tempF.extremeHeatMin) return 'extreme_heat';
  if (cur.temperature_2m != null && cur.temperature_2m <= THRESH.tempF.hardFreezeMax) return 'hard_freeze';
  const calmClear = (cur.cloud_cover == null || cur.cloud_cover < 50) && (cur.wind_speed_10m == null || cur.wind_speed_10m < 8);
  if (cur.temperature_2m != null && cur.temperature_2m <= THRESH.tempF.frostMax && calmClear) return 'frost';
  return null;
}

function resolveDustFamily(aq, cur) {
  if (!aq || aq.dust == null) return null;
  const wind = (cur && cur.wind_speed_10m != null) ? cur.wind_speed_10m : 0;
  if (aq.dust >= THRESH.dustUgm3.storm && wind >= 30) return 'dust_storm';
  if (aq.dust >= THRESH.dustUgm3.blowing && wind >= 20) return 'blowing_dust';
  return null;
}

function resolveGroundBlizzard(cur) {
  if (!cur) return null;
  const notPrecipitating = [0, 1, 2, 3].indexOf(cur.weather_code) !== -1;
  if (notPrecipitating && cur.snow_depth != null && cur.snow_depth > 0.05 &&
    cur.wind_speed_10m != null && cur.wind_speed_10m >= 25 &&
    cur.temperature_2m != null && cur.temperature_2m <= 25) {
    return 'ground_blizzard';
  }
  return null;
}

function resolveBlizzardHeuristic(cur) {
  if (!cur) return null;
  const snowing = [71, 73, 75, 85, 86].indexOf(cur.weather_code) !== -1;
  if (!snowing) return null;
  const wind = cur.wind_speed_10m || 0;
  const visMi = cur.visibility != null ? cur.visibility / 1609.34 : 999;
  if (wind >= THRESH.extremeBlizzardWindMph && visMi < 0.15 && cur.temperature_2m != null && cur.temperature_2m <= 10) {
    return 'extreme_blizzard';
  }
  if (wind >= THRESH.blizzardWindMph && visMi < THRESH.blizzardVisMi) return 'blizzard';
  return null;
}

function resolveFlashFloodHeuristic(cur) {
  if (!cur || cur.precipitation == null) return null;
  return cur.precipitation >= THRESH.flashFloodInHr ? 'flash_flooding' : null;
}

function resolveBombCyclone(pressureDrop24h) {
  if (pressureDrop24h == null) return null;
  return pressureDrop24h >= THRESH.pressureDropHpa24h ? 'bomb_cyclone' : null;
}

function resolveMultiDay(heatDays, coldDays) {
  if (coldDays >= 3) return 'cold_wave';
  if (heatDays >= 3) return 'heat_wave';
  return null;
}

function resolveCurrentConditionId(bundle) {
  const candidates = [];
  function push(id) { if (id && CONDITIONS_BY_ID[id]) candidates.push(id); }

  push(resolveSky(bundle.current));
  push(resolveFogFamily(bundle.current, bundle.airQuality));
  push(resolvePrecipFamily(bundle.current));
  push(resolveWindFamily(bundle.current));
  push(resolveThunderFamily(bundle.current));
  push(resolveTempExtremes(bundle.current));
  push(resolveDustFamily(bundle.airQuality, bundle.current));
  push(resolveGroundBlizzard(bundle.current));
  push(resolveBlizzardHeuristic(bundle.current));
  push(resolveFlashFloodHeuristic(bundle.current));
  push(resolveBombCyclone(bundle.pressureDrop24h));
  push(resolveMultiDay(bundle.heatWaveDays, bundle.coldWaveDays));
  (bundle.nwsConditionIds || []).forEach(push);

  if (!candidates.length) return 'clear_skies';
  candidates.sort(function (a, b) { return tierRank(CONDITIONS_BY_ID[b].tier) - tierRank(CONDITIONS_BY_ID[a].tier); });
  return candidates[0];
}

function buildStatsFromBundle(bundle) {
  const cur = bundle.current || {};
  return {
    rainInHr: (cur.rain != null ? cur.rain : cur.precipitation) || 0,
    tempF: cur.temperature_2m,
    windMph: cur.wind_speed_10m,
    pressureMb: cur.pressure_msl != null ? cur.pressure_msl : cur.surface_pressure,
    visibilityMi: cur.visibility != null ? cur.visibility / 1609.34 : null,
    uv: cur.uv_index,
    aqi: bundle.airQuality ? bundle.airQuality.us_aqi : null
  };
}

/* =============================================================================
   6. RENDERING — banners + stat strip
   ========================================================================== */

function makeWarningIcon() {
  const span = document.createElement('span');
  span.className = 'warning-icon';
  span.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M12 3.5 22 20.5H2L12 3.5Z" fill="#fff" fill-opacity="0.95"/>' +
    '<rect x="11" y="9.5" width="2" height="6" rx="1" fill="#7a1010"/>' +
    '<rect x="11" y="16.5" width="2" height="2" rx="1" fill="#7a1010"/></svg>';
  return span;
}

function applyCondition(id, opts) {
  opts = opts || {};
  const cond = CONDITIONS_BY_ID[id];
  if (!cond) return;
  const tier = WEATHER_TIERS[cond.tier];
  state.activeConditionId = id;

  document.documentElement.style.setProperty('--tier-rgb', hexToRgbString(tier.color));
  document.documentElement.style.setProperty('--tier-hex', tier.color);

  el.conditionBanner.innerHTML = '';
  el.conditionBanner.appendChild(makeWarningIcon());
  el.conditionBanner.appendChild(document.createTextNode(cond.title));
  el.conditionBanner.classList.toggle('is-severe', !!tier.flashing);

  el.conditionFooter.innerHTML = '';
  el.conditionFooter.appendChild(makeWarningIcon());
  el.conditionFooter.appendChild(document.createTextNode(cond.description));
  el.conditionFooter.classList.toggle('is-severe', !!tier.flashing);

  el.effectLayer.classList.add('is-transitioning');
  setTimeout(function () {
    renderEffect(cond);
    el.effectLayer.classList.remove('is-transitioning');
  }, 180);

  if (!opts.silent) highlightActiveMenuItem(id);
}

function updateStatsDisplay(stats) {
  el.statRain.textContent = fmtNum(stats.rainInHr, 2) + ' in/hr';
  el.statTemp.textContent = stats.tempF != null ? Math.round(stats.tempF) + '\u00B0F' : '\u2014';
  el.statWind.textContent = stats.windMph != null ? Math.round(stats.windMph) + ' mph' : '\u2014';
  el.statPressure.textContent = stats.pressureMb != null ? Math.round(stats.pressureMb) + ' mb' : '\u2014';
  el.statVisibility.textContent = stats.visibilityMi != null ? fmtNum(stats.visibilityMi, 1) + ' mi' : '\u2014';
  el.statUv.textContent = stats.uv != null ? Math.round(stats.uv) : '\u2014';
  el.statAqi.textContent = stats.aqi != null ? Math.round(stats.aqi) : '\u2014';
}

/* =============================================================================
   7. RENDERING — animation layer
   ========================================================================== */

function spawnParticles(container, count, className, varsFn) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    d.className = className;
    const vars = varsFn(i);
    Object.keys(vars).forEach(function (k) { d.style.setProperty(k, vars[k]); });
    frag.appendChild(d);
  }
  container.appendChild(frag);
}

function scheduleLightning(flashEl, intensity) {
  function fire() {
    if (!flashEl.isConnected) return; // condition changed under us — stop
    flashEl.classList.remove('flash');
    void flashEl.offsetWidth; // restart the CSS animation
    flashEl.classList.add('flash');
    lightningTimer = setTimeout(fire, rand(2500, 7000) / (0.5 + intensity * 0.3));
  }
  lightningTimer = setTimeout(fire, rand(400, 1500));
}

function fx_sky(container, intensity) {
  const sun = document.createElement('div');
  sun.className = 'fx-sun';
  sun.style.opacity = String(clamp(1.15 - intensity * 0.16, 0.15, 1));
  container.appendChild(sun);

  const cloudCounts = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 6, 6: 0 };
  const n = cloudCounts[intensity] != null ? cloudCounts[intensity] : 2;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'fx-cloud';
    c.style.setProperty('--cy', rand(10, 55) + '%');
    c.style.setProperty('--cw', rand(90, 190) + 'px');
    c.style.setProperty('--ch', rand(30, 54) + 'px');
    c.style.setProperty('--cop', String(rand(0.65, 0.95)));
    c.style.setProperty('--dur', rand(38, 70) + 's');
    c.style.setProperty('--delay', (-rand(0, 60)) + 's');
    container.appendChild(c);
  }
  if (intensity === 6) {
    const sheet = document.createElement('div');
    sheet.className = 'fx-cloud overcast-sheet';
    sheet.style.setProperty('--cy', '8%');
    sheet.style.setProperty('--dur', '80s');
    container.appendChild(sheet);
  }
}

function fx_fog(container, intensity, cond) {
  const bands = clamp(intensity, 1, 4);
  for (let i = 0; i < bands + 1; i++) {
    const b = document.createElement('div');
    b.className = 'fx-fog-band' + (cond.icy ? ' icy' : '');
    b.style.setProperty('--h', rand(50, 90) + 'px');
    b.style.setProperty('--top', rand(10, 80) + '%');
    b.style.setProperty('--op', String(clamp(0.25 + intensity * 0.12, 0.25, 0.75)));
    b.style.setProperty('--dur', rand(18, 32) + 's');
    b.style.setProperty('--delay', (-rand(0, 20)) + 's');
    container.appendChild(b);
  }
}

function fx_rain(container, intensity, cond) {
  cond = cond || {};
  const count = Math.round(18 + intensity * 22);
  spawnParticles(container, count, 'fx-drop' + (cond.icy ? ' icy' : ''), function () {
    return {
      '--x': rand(-5, 105) + '%',
      '--h': rand(14, 26) + 'px',
      '--dur': (rand(0.5, 1.3) / (0.5 + intensity * 0.25)) + 's',
      '--delay': (-rand(0, 2)) + 's',
      '--angle': rand(4, 12) + 'deg'
    };
  });
  if (cond.icy) {
    spawnParticles(container, 10, 'fx-glint', function () {
      return { '--x': rand(0, 100) + '%', '--y': rand(40, 95) + '%', '--delay': (-rand(0, 2.4)) + 's' };
    });
  }
}

function fx_snow(container, intensity, cond) {
  cond = cond || {};
  const count = Math.round(24 + intensity * 18);
  spawnParticles(container, count, 'fx-flake', function () {
    return {
      '--x': rand(-5, 105) + '%',
      '--s': rand(3, 4 + intensity) + 'px',
      '--op': String(rand(0.6, 1)),
      '--dur': (rand(6, 11) / (0.6 + intensity * 0.3)) + 's',
      '--delay': (-rand(0, 10)) + 's',
      '--sway': (cond.windOverlay ? rand(60, 120) : rand(10, 30)) + 'px'
    };
  });
  if (cond.windOverlay) fx_wind(container, Math.min(5, intensity + 1));
}

function fx_hail(container, intensity) {
  const count = Math.round(10 + intensity * 8);
  const size = 3 + intensity * 1.6;
  spawnParticles(container, count, 'fx-pellet', function () {
    return {
      '--x': rand(-5, 105) + '%',
      '--s': rand(size * 0.7, size * 1.3) + 'px',
      '--dur': rand(0.7, 1.1) + 's',
      '--delay': (-rand(0, 1.2)) + 's'
    };
  });
}

function fx_sleet(container, intensity) {
  fx_rain(container, Math.max(1, intensity - 1), { icy: true });
  fx_hail(container, Math.max(1, intensity - 1));
}

function fx_thunder(container, intensity) {
  const tint = document.createElement('div');
  tint.className = 'fx-tint fx-storm-tint';
  container.appendChild(tint);
  fx_rain(container, clamp(intensity, 2, 5));
  const flash = document.createElement('div');
  flash.className = 'fx-lightning';
  container.appendChild(flash);
  scheduleLightning(flash, intensity);
}

function fx_wind(container, intensity) {
  const count = Math.round(6 + intensity * 5);
  spawnParticles(container, count, 'fx-streak', function () {
    return {
      '--y': rand(5, 90) + '%',
      '--w': rand(60, 140) + 'px',
      '--op': String(rand(0.3, 0.7)),
      '--dur': (rand(1.0, 2.6) / (0.4 + intensity * 0.25)) + 's',
      '--delay': (-rand(0, 2)) + 's'
    };
  });
  if (intensity >= 4) el.weatherBox.classList.add('shake');
}

function fx_dust(container, intensity) {
  const count = Math.round(6 + intensity * 5);
  spawnParticles(container, count, 'fx-particle-cloud', function () {
    return {
      '--x': rand(0, 90) + '%', '--y': rand(10, 90) + '%',
      '--s': rand(80, 60 + intensity * 40) + 'px',
      '--pc': 'rgba(196,164,105,' + rand(0.35, 0.6) + ')',
      '--dur': rand(10, 18) + 's', '--delay': (-rand(0, 14)) + 's'
    };
  });
  fx_wind(container, Math.min(5, intensity));
}

function fx_smoke(container, intensity) {
  const count = Math.round(5 + intensity * 4);
  spawnParticles(container, count, 'fx-particle-cloud', function () {
    return {
      '--x': rand(0, 90) + '%', '--y': rand(5, 80) + '%',
      '--s': rand(90, 70 + intensity * 50) + 'px',
      '--pc': 'rgba(140,130,120,' + rand(0.35, 0.55) + ')',
      '--dur': rand(14, 24) + 's', '--delay': (-rand(0, 18)) + 's'
    };
  });
}

function fx_ash(container, intensity) {
  const tint = document.createElement('div');
  tint.className = 'fx-tint';
  tint.style.background = 'rgba(90,90,90,0.18)';
  container.appendChild(tint);
  spawnParticles(container, 30 + intensity * 6, 'fx-ash-flake', function () {
    return { '--x': rand(-5, 105) + '%', '--s': rand(3, 6) + 'px', '--dur': rand(9, 16) + 's', '--delay': (-rand(0, 14)) + 's' };
  });
}

function fx_heat(container, intensity) {
  const tint = document.createElement('div');
  tint.className = 'fx-tint';
  tint.style.background = 'linear-gradient(180deg, rgba(255,120,60,' + (0.08 + intensity * 0.03) + '), transparent 55%)';
  container.appendChild(tint);
  const sun = document.createElement('div');
  sun.className = 'fx-sun';
  sun.style.width = sun.style.height = (90 + intensity * 10) + 'px';
  container.appendChild(sun);
  for (let i = 0; i < 4; i++) {
    const w = document.createElement('div');
    w.className = 'fx-heat-wave';
    w.style.setProperty('--b', (4 + i * 7) + '%');
    w.style.setProperty('--dur', rand(2, 3.2) + 's');
    w.style.setProperty('--delay', (-rand(0, 2)) + 's');
    container.appendChild(w);
  }
}

function fx_cold(container, intensity) {
  const tint = document.createElement('div');
  tint.className = 'fx-tint';
  tint.style.background = 'linear-gradient(180deg, rgba(150,200,255,' + (0.06 + intensity * 0.045) + '), transparent 60%)';
  container.appendChild(tint);
  spawnParticles(container, 16 + intensity * 6, 'fx-frost-speck', function () {
    return { '--x': rand(0, 100) + '%', '--y': rand(0, 100) + '%', '--s': rand(2, 4) + 'px', '--dur': rand(2, 4) + 's', '--delay': (-rand(0, 3)) + 's' };
  });
}

function fx_flood(container, intensity) {
  const level = 12 + intensity * 9;
  const w = document.createElement('div');
  w.className = 'fx-water' + (intensity >= 4 ? ' rising' : '');
  w.style.setProperty('--level', level + '%');
  container.appendChild(w);
}

function fx_tornado(container, intensity) {
  const tint = document.createElement('div');
  tint.className = 'fx-tint';
  tint.style.background = 'linear-gradient(180deg, rgba(55,60,66,' + (0.25 + intensity * 0.09) + '), rgba(30,32,36,0.15))';
  container.appendChild(tint);

  const funnel = document.createElement('div');
  funnel.className = 'fx-funnel';
  funnel.style.setProperty('--w', (34 + intensity * 10) + 'px');
  funnel.style.setProperty('--tilt', rand(-6, 6) + 'deg');
  funnel.style.setProperty('--dur', (4.2 - intensity * 0.4) + 's');
  container.appendChild(funnel);

  const orbit = document.createElement('div');
  orbit.className = 'fx-orbit';
  orbit.style.setProperty('--orbit', (60 + intensity * 18) + 'px');
  orbit.style.setProperty('--dur', (3 - intensity * 0.3) + 's');
  const dotCount = 3 + intensity;
  for (let i = 0; i < dotCount; i++) {
    const angle = (2 * Math.PI * i) / dotCount;
    const dot = document.createElement('div');
    dot.className = 'dot';
    // The container itself spins (see .fx-orbit's animation); each dot just
    // needs a fixed spot on the ring, placed with plain trigonometry.
    dot.style.left = (50 + 50 * Math.cos(angle)) + '%';
    dot.style.top = (50 + 50 * Math.sin(angle)) + '%';
    orbit.appendChild(dot);
  }
  container.appendChild(orbit);
  if (intensity >= 5) fx_wind(container, 3);
}

function fx_hurricane(container, intensity) {
  const tint = document.createElement('div');
  tint.className = 'fx-tint';
  tint.style.background = 'radial-gradient(circle at 50% 50%, rgba(60,68,80,0.1), rgba(30,34,42,' + (0.25 + intensity * 0.08) + ') 75%)';
  container.appendChild(tint);
  for (let i = 0; i < 3; i++) {
    const arm = document.createElement('div');
    arm.className = 'fx-spiral-arm';
    arm.style.setProperty('--d', (140 + i * 70 + intensity * 10) + 'px');
    arm.style.setProperty('--op', String(0.5 - i * 0.1));
    arm.style.setProperty('--dur', (22 - i * 4 - intensity) + 's');
    container.appendChild(arm);
  }
  const eye = document.createElement('div');
  eye.className = 'fx-eye';
  eye.style.setProperty('--d', '50px');
  container.appendChild(eye);
  fx_rain(container, Math.min(5, intensity));
  fx_wind(container, Math.min(5, intensity));
}

function fx_multi(container) {
  const tint = document.createElement('div');
  tint.className = 'fx-tint fx-storm-tint';
  container.appendChild(tint);
  fx_rain(container, 5);
  fx_wind(container, 5);
  fx_dust(container, 2);
  const flash = document.createElement('div');
  flash.className = 'fx-lightning';
  container.appendChild(flash);
  scheduleLightning(flash, 5);
}

const FX_RENDERERS = {
  sky: fx_sky, fog: fx_fog, rain: fx_rain, snow: fx_snow, hail: fx_hail, sleet: fx_sleet,
  thunder: fx_thunder, wind: fx_wind, dust: fx_dust, smoke: fx_smoke, ash: fx_ash,
  heat: fx_heat, cold: fx_cold, flood: fx_flood, tornado: fx_tornado, hurricane: fx_hurricane,
  multi: fx_multi
};

function renderEffect(cond) {
  el.effectLayer.innerHTML = '';
  el.weatherBox.classList.remove('shake');
  if (lightningTimer) { clearTimeout(lightningTimer); lightningTimer = null; }
  const renderer = FX_RENDERERS[cond.effect];
  if (renderer) renderer(el.effectLayer, cond.intensity, cond);
}

/* =============================================================================
   8. TEST MENU

   Everything between the DEV PANEL markers below is ONLY used by the test
   menu. highlightActiveMenuItem() and setMode() stay outside that block on
   purpose — setMode() is also used by the "Use my location" / ZIP controls
   in section 9, and highlightActiveMenuItem() is called from applyCondition()
   in section 6. Both already no-op safely if the dev-panel elements don't
   exist, so you never have to touch them.
   ========================================================================== */

function highlightActiveMenuItem(id) {
  if (!el.conditionGroups) return; // dev panel not present — nothing to highlight, and nothing to break
  const buttons = el.conditionGroups.querySelectorAll('.condition-option');
  buttons.forEach(function (btn) { btn.classList.toggle('active', btn.dataset.id === id); });
}

function setMode(mode) {
  state.mode = mode;
  if (el.modeLiveBtn) el.modeLiveBtn.classList.toggle('active', mode === 'live');
  if (el.modeTestBtn) el.modeTestBtn.classList.toggle('active', mode === 'test');
  if (mode === 'live') {
    stopAutoRefresh();
    startAutoRefresh();
    refreshLiveWeather(true);
  } else {
    stopAutoRefresh();
  }
}

// ============================= DEV PANEL: START =============================
// To remove the test menu: delete from here down to "DEV PANEL: END" below,
// PLUS the matching block in index.html, PLUS (optionally, just for a
// smaller stylesheet) the "Test menu" block in styles.css. See the DEV PANEL
// markers in the `el` object above and in init() near the bottom of this
// file too. To restore it later, paste all of those blocks back — nothing
// elsewhere in the file references anything in here.

function plausibleStatsFor(cond) {
  const s = { rainInHr: 0, tempF: 68, windMph: 6, pressureMb: 1015, visibilityMi: 10, uv: 4, aqi: 35 };
  const i = cond.intensity;
  switch (cond.effect) {
    case 'rain': s.rainInHr = pick([0, 0.02, 0.08, 0.15, 0.35, 0.75], i, 0.3); s.pressureMb -= i * 2; break;
    case 'snow': s.tempF = 30 - i * 4; s.rainInHr = 0.05 * i; break;
    case 'hail': case 'sleet': s.tempF = 33; s.rainInHr = 0.1 * i; break;
    case 'thunder': s.rainInHr = 0.2 * i; s.pressureMb -= i * 3; s.windMph = 10 + i * 6; break;
    case 'wind': s.windMph = 10 + i * 11; s.pressureMb -= i * 2; break;
    case 'dust': s.windMph = 15 + i * 8; s.visibilityMi = Math.max(0.1, 6 - i); s.aqi = 80 + i * 60; break;
    case 'smoke': s.aqi = 90 + i * 45; s.visibilityMi = Math.max(0.5, 8 - i * 1.5); break;
    case 'ash': s.aqi = 150 + i * 40; s.visibilityMi = 1; break;
    case 'heat': s.tempF = 98 + i * 4; s.uv = 9; break;
    case 'cold': s.tempF = 25 - i * 12; break;
    case 'flood': s.rainInHr = 0.8 + i * 0.3; s.pressureMb -= 8; break;
    case 'tornado': s.windMph = 40 + i * 25; s.pressureMb -= 15 + i * 3; s.rainInHr = 0.6; break;
    case 'hurricane': s.windMph = 50 + i * 20; s.pressureMb = 990 - i * 15; s.rainInHr = 1 + i * 0.4; break;
    case 'multi': s.windMph = 90; s.pressureMb = 950; s.rainInHr = 2.2; break;
    case 'fog': s.visibilityMi = pick([6, 2, 0.8, 0.15], i - 1, 1); break;
    case 'sky': s.uv = Math.max(1, 8 - i); break;
    default: break;
  }
  return s;
}

function fillStatOverrideInputs(s) {
  el.ovRain.value = s.rainInHr.toFixed(2);
  el.ovTemp.value = Math.round(s.tempF);
  el.ovWind.value = Math.round(s.windMph);
  el.ovPressure.value = Math.round(s.pressureMb);
  el.ovVisibility.value = s.visibilityMi.toFixed(1);
  el.ovUv.value = Math.round(s.uv);
  el.ovAqi.value = Math.round(s.aqi);
}

function readStatOverrides() {
  function v(input) { return input.value === '' ? null : parseFloat(input.value); }
  return {
    rainInHr: v(el.ovRain) || 0, tempF: v(el.ovTemp), windMph: v(el.ovWind),
    pressureMb: v(el.ovPressure), visibilityMi: v(el.ovVisibility), uv: v(el.ovUv), aqi: v(el.ovAqi)
  };
}

function selectTestCondition(id) {
  setMode('test');
  const cond = CONDITIONS_BY_ID[id];
  applyCondition(id);
  const stats = plausibleStatsFor(cond);
  fillStatOverrideInputs(stats);
  updateStatsDisplay(stats);
}

function buildTestMenu() {
  el.conditionGroups.innerHTML = '';
  TIER_ORDER.forEach(function (tierKey) {
    const conds = WEATHER_CONDITIONS.filter(function (c) { return c.tier === tierKey; });
    if (!conds.length) return;
    const tier = WEATHER_TIERS[tierKey];

    const details = document.createElement('details');
    details.className = 'tier-group';
    const summary = document.createElement('summary');
    const swatch = document.createElement('span');
    swatch.className = 'tier-swatch';
    swatch.style.background = tier.color;
    summary.appendChild(swatch);
    summary.appendChild(document.createTextNode(tier.label));
    const count = document.createElement('span');
    count.className = 'tier-count';
    count.textContent = String(conds.length);
    summary.appendChild(count);
    details.appendChild(summary);

    conds.forEach(function (c) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'condition-option';
      btn.dataset.id = c.id;
      btn.textContent = c.title.replace(/^You're |^Your /, '');
      const badge = document.createElement('span');
      badge.className = 'source-badge src-' + c.source;
      badge.textContent = c.source;
      btn.appendChild(badge);
      btn.addEventListener('click', function () { selectTestCondition(c.id); });
      details.appendChild(btn);
    });

    el.conditionGroups.appendChild(details);
  });
}

function openTestMenu() {
  el.testMenu.classList.add('open');
  el.testMenuBackdrop.classList.add('open');
  el.testMenuToggle.setAttribute('aria-expanded', 'true');
}
function closeTestMenu() {
  el.testMenu.classList.remove('open');
  el.testMenuBackdrop.classList.remove('open');
  el.testMenuToggle.setAttribute('aria-expanded', 'false');
}
// ============================== DEV PANEL: END ==============================

/* =============================================================================
   9. LOCATION CONTROLS + LIVE REFRESH
   ========================================================================== */

function setLocationStatus(label, source) {
  el.locationName.innerHTML = '';
  el.locationName.appendChild(document.createTextNode('Showing weather for '));
  const strong = document.createElement('strong');
  strong.textContent = label || 'your area';
  el.locationName.appendChild(strong);
  if (source) el.locationName.appendChild(document.createTextNode(' \u00B7 ' + source));
}

function setLocationError(msg) {
  const hint = el.testMenuToggle ? ' Try a ZIP/postal code below, or open the test menu.' : ' Try a ZIP/postal code below.';
  el.locationName.textContent = msg + hint;
}

async function refreshLiveWeather(announce) {
  try {
    if (announce && !state.location) el.locationName.textContent = 'Finding your location\u2026';
    if (!state.location) state.location = await locateByIP();

    const loc = state.location;
    setLocationStatus(loc.label, loc.source);

    const wantsNws = !loc.countryCode || NWS_COVERED.indexOf(loc.countryCode) !== -1;
    const results = await Promise.allSettled([
      fetchOpenMeteo(loc.lat, loc.lon),
      fetchAirQuality(loc.lat, loc.lon),
      wantsNws ? resolveFromNws(loc.lat, loc.lon) : Promise.resolve({ ids: [] })
    ]);

    const meteo = results[0].status === 'fulfilled' ? results[0].value : null;
    const aq = results[1].status === 'fulfilled' ? results[1].value : null;
    const nws = results[2].status === 'fulfilled' ? results[2].value : { ids: [] };

    if (!meteo) throw new Error('Weather data is temporarily unavailable.');

    const bundle = {
      current: meteo.current,
      airQuality: aq,
      pressureDrop24h: meteo.pressureDrop24h,
      heatWaveDays: meteo.heatWaveDays,
      coldWaveDays: meteo.coldWaveDays,
      nwsConditionIds: nws.ids
    };

    if (state.mode === 'live') {
      const conditionId = resolveCurrentConditionId(bundle);
      applyCondition(conditionId, { silent: true });
      updateStatsDisplay(buildStatsFromBundle(bundle));
    }
  } catch (err) {
    console.error(err);
    setLocationError(err.message || 'Something went wrong fetching live weather.');
  }
}

function wireLocationControls() {
  el.useIpBtn.addEventListener('click', function () {
    state.location = null;
    setMode('live');
  });

  function submitZip() {
    const zip = el.zipInput.value.trim();
    if (!zip) return;
    const country = el.countrySelect.value;
    el.zipSubmit.disabled = true;
    el.locationName.textContent = 'Looking up ' + zip + '\u2026';
    locateByZip(zip, country).then(function (loc) {
      state.location = loc;
      setMode('live');
    }).catch(function (err) {
      setLocationError(err.message || 'Could not find that postal code.');
    }).finally(function () {
      setTimeout(function () { el.zipSubmit.disabled = false; }, 1100); // be polite to Nominatim's ~1/sec limit
    });
  }
  el.zipSubmit.addEventListener('click', submitZip);
  el.zipInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitZip(); });
}

function startAutoRefresh() {
  stopAutoRefresh();
  state.refreshTimer = setInterval(function () {
    if (state.mode === 'live' && document.visibilityState === 'visible') refreshLiveWeather(false);
  }, CONFIG.refreshIntervalMs);
}
function stopAutoRefresh() {
  if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null; }
}

/* =============================================================================
   10. INIT
   ========================================================================== */

function init() {
  wireLocationControls();

  // ============================= DEV PANEL: START =============================
  // Guarded on el.testMenuToggle existing, so if you've deleted the dev-panel
  // block from index.html, this whole section is skipped automatically —
  // nothing here needs to be touched for that removal to work.
  if (el.testMenuToggle) {
    buildTestMenu();

    [el.ovRain, el.ovTemp, el.ovWind, el.ovPressure, el.ovVisibility, el.ovUv, el.ovAqi].forEach(function (input) {
      input.addEventListener('input', function () { if (state.mode === 'test') updateStatsDisplay(readStatOverrides()); });
    });

    el.testMenuToggle.addEventListener('click', openTestMenu);
    el.testMenuClose.addEventListener('click', closeTestMenu);
    el.testMenuBackdrop.addEventListener('click', closeTestMenu);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTestMenu(); });

    el.modeLiveBtn.addEventListener('click', function () { setMode('live'); });
    el.modeTestBtn.addEventListener('click', function () { setMode('test'); });
  }
  // ============================== DEV PANEL: END ==============================

  applyCondition('clear_skies', { silent: true }); // instant, friendly default while real data loads
  refreshLiveWeather(true);
  startAutoRefresh();
}

document.addEventListener('DOMContentLoaded', init);
