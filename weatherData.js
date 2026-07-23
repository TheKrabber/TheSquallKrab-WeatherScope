/**
 * weatherData.js
 * ---------------------------------------------------------------------------
 * Pure presentation data. No fetching, no DOM work — just the 90 weather
 * conditions this site knows how to show, grouped into 13 color tiers.
 *
 * Edit this file to change wording/colors, or to add conditions to the two
 * empty tiers (amber, brown) that were left without entries in the brief.
 *
 * Each condition:
 *   id          unique slug, used everywhere else to refer to this condition
 *   tier        key into WEATHER_TIERS (controls color + whether it flashes)
 *   title       shown in the small banner at the top of the screen
 *   description shown in the banner at the bottom of the screen
 *   effect      which animation renderer in app.js draws the middle box
 *   intensity   1-5 (1-6 for "sky") — how strong/dense that animation is
 *   icy         optional. true = tint the effect icy-blue (freezing variants)
 *   windOverlay optional. true = layer wind streaks on top of the effect
 *   source      how this condition can be reached automatically. One of:
 *
 *     'live'    detected anywhere in the world from Open-Meteo (+ its Air
 *               Quality API) using weather codes, plain thresholds, or a
 *               simple physical rule (e.g. a 24-hour pressure drop).
 *     'approx'  detected automatically, but only as a rough stand-in for the
 *               named phenomenon (e.g. "Polar Vortex Outbreak" really just
 *               means "extremely, unusually cold" here — see README).
 *     'live-us' detected automatically ONLY for the United States and its
 *               territories, from active alerts at api.weather.gov.
 *     'manual'  never triggered automatically. Fully styled and animated,
 *               reachable only from the test menu — see README for why.
 *
 * See README.md for the full explanation of every source and every country
 * limitation.
 * ---------------------------------------------------------------------------
 */

const WEATHER_TIERS = {
  green:      { label: 'Green',       color: '#00C853', flashing: false },
  lime:       { label: 'Lime Green',  color: '#64DD17', flashing: false },
  yellow:     { label: 'Yellow',      color: '#FFEB3B', flashing: false },
  amber:      { label: 'Amber',       color: '#FFC107', flashing: false },
  orange:     { label: 'Orange',      color: '#FF9800', flashing: false },
  darkorange: { label: 'Dark Orange', color: '#F57C00', flashing: false },
  red:        { label: 'Red',         color: '#F44336', flashing: true  },
  darkred:    { label: 'Dark Red',    color: '#C62828', flashing: true  },
  crimson:    { label: 'Crimson',     color: '#B71C1C', flashing: true  },
  purple:     { label: 'Purple',      color: '#8E24AA', flashing: true  },
  darkpurple: { label: 'Dark Purple', color: '#4A148C', flashing: true  },
  brown:      { label: 'Brown',       color: '#6D4C41', flashing: true  },
  maroon:     { label: 'Maroon',      color: '#800000', flashing: true  }
};

// Severity order, low to high. Used to pick a winner when more than one
// condition could apply at once (e.g. an NWS alert AND a heuristic match).
const TIER_ORDER = ['green', 'lime', 'yellow', 'amber', 'orange', 'darkorange',
  'red', 'darkred', 'crimson', 'purple', 'darkpurple', 'brown', 'maroon'];

function tierRank(tierKey) {
  return TIER_ORDER.indexOf(tierKey);
}

const WEATHER_CONDITIONS = [

  // ======================= GREEN — #00C853 =======================
  { id: 'clear_skies', tier: 'green', source: 'live', effect: 'sky', intensity: 1,
    title: "Your Skies Are Clear",
    description: "Clear skies and abundant sunshine make for excellent weather. Enjoy outdoor activities. Stay hydrated if temperatures are high." },

  { id: 'mostly_clear', tier: 'green', source: 'live', effect: 'sky', intensity: 2,
    title: "Your Skies Are Mostly Clear",
    description: "Mostly sunny skies with only a few passing clouds. No special precautions are necessary." },

  { id: 'partly_clear', tier: 'green', source: 'live', effect: 'sky', intensity: 3,
    title: "Your Skies Are Partly Clear",
    description: "A mixture of sunshine and clouds throughout the day. No special precautions are necessary." },

  { id: 'partly_cloudy', tier: 'green', source: 'live', effect: 'sky', intensity: 4,
    title: "Your Skies Are Partly Cloudy",
    description: "Clouds and sunshine alternate throughout the day. No special precautions are necessary." },

  { id: 'breezy', tier: 'green', source: 'live', effect: 'wind', intensity: 1,
    title: "Your Area Is Breezy",
    description: "Light to moderate winds are occurring. No special precautions are necessary." },

  // ===================== LIME GREEN — #64DD17 =====================
  { id: 'mostly_cloudy', tier: 'lime', source: 'live', effect: 'sky', intensity: 5,
    title: "Your Skies Are Mostly Cloudy",
    description: "Clouds cover most of the sky with little sunshine. Keep an eye on the forecast for changing conditions." },

  { id: 'overcast', tier: 'lime', source: 'live', effect: 'sky', intensity: 6,
    title: "You're Experiencing Overcast",
    description: "The sky is completely covered with clouds. No special precautions are necessary." },

  // ======================= YELLOW — #FFEB3B =======================
  { id: 'haze', tier: 'yellow', source: 'live', effect: 'fog', intensity: 1,
    title: "You're Experiencing Haze",
    description: "Fine particles reduce visibility slightly and make the sky appear dull. Sensitive individuals should limit prolonged outdoor activity." },

  { id: 'mist', tier: 'yellow', source: 'live', effect: 'fog', intensity: 2,
    title: "You're Experiencing Mist",
    description: "Tiny water droplets slightly reduce visibility. Drive carefully and allow extra stopping distance." },

  { id: 'sprinkles', tier: 'yellow', source: 'live', effect: 'rain', intensity: 1,
    title: "You're Experiencing Sprinkles",
    description: "A few light raindrops are falling. No special precautions are necessary." },

  { id: 'drizzle', tier: 'yellow', source: 'live', effect: 'rain', intensity: 2,
    title: "You're Experiencing Drizzle",
    description: "Light, steady precipitation is occurring. Roads may become slick. Drive carefully." },

  { id: 'windy', tier: 'yellow', source: 'live', effect: 'wind', intensity: 2,
    title: "Your Area Is Windy",
    description: "Steady strong winds are present. Secure loose outdoor objects." },

  { id: 'tropical_disturbance', tier: 'yellow', source: 'manual', effect: 'hurricane', intensity: 1,
    title: "You're Experiencing A Tropical Disturbance",
    description: "An area of tropical weather is being monitored. Monitor future forecasts." },

  { id: 'frost', tier: 'yellow', source: 'approx', effect: 'cold', intensity: 1,
    title: "You're Experiencing Frost",
    description: "Temperatures near freezing may damage vegetation. Protect sensitive plants." },

  // ======================= AMBER — #FFC107 =======================
  // No conditions were specified for this tier in the brief. It's fully
  // wired up (color + test menu group) — add entries here any time.

  // ======================= ORANGE — #FF9800 =======================
  { id: 'smoke', tier: 'orange', source: 'live', effect: 'smoke', intensity: 2,
    title: "You're Experiencing Smoke",
    description: "Smoke from wildfires or other sources is reducing air quality and visibility. Limit outdoor activity if air quality is poor and keep windows closed." },

  { id: 'fog', tier: 'orange', source: 'live', effect: 'fog', intensity: 3,
    title: "You're Experiencing Fog",
    description: "Visibility is reduced by suspended water droplets. Use low-beam headlights and slow down while driving." },

  { id: 'light_rain', tier: 'orange', source: 'live', effect: 'rain', intensity: 3,
    title: "You're Experiencing Light Rain",
    description: "Light rain is falling across the area. Use caution on wet roads." },

  { id: 'light_snow', tier: 'orange', source: 'live', effect: 'snow', intensity: 2,
    title: "You're Experiencing Light Snow",
    description: "Light snowfall is occurring with little accumulation. Allow extra travel time and watch for slippery spots." },

  { id: 'rain', tier: 'orange', source: 'live', effect: 'rain', intensity: 4,
    title: "You're Experiencing Rain",
    description: "Steady rainfall is occurring. Use caution while driving." },

  { id: 'snow', tier: 'orange', source: 'live', effect: 'snow', intensity: 3,
    title: "You're Experiencing Snow",
    description: "Snow is falling and may accumulate. Reduce speed and prepare for winter travel." },

  { id: 'graupel', tier: 'orange', source: 'live', effect: 'hail', intensity: 1,
    title: "You're Experiencing Graupel",
    description: "Soft hail or snow pellets are falling. Use caution outdoors and while driving." },

  { id: 'small_hail', tier: 'orange', source: 'live-us', effect: 'hail', intensity: 2,
    title: "You're Experiencing Small Hail",
    description: "Small hail is falling. Move indoors until the hail ends." },

  { id: 'isolated_thunderstorms', tier: 'orange', source: 'live', effect: 'thunder', intensity: 1,
    title: "You're Experiencing Isolated Thunderstorms",
    description: "A few thunderstorms are developing. Go indoors if thunder is heard." },

  { id: 'blowing_snow', tier: 'orange', source: 'live', effect: 'snow', intensity: 3, windOverlay: true,
    title: "You're Experiencing Blowing Snow",
    description: "Snow is reducing visibility due to strong winds. Travel only if necessary." },

  { id: 'very_windy', tier: 'orange', source: 'live', effect: 'wind', intensity: 3,
    title: "Your Area Is Very Windy",
    description: "Very strong winds are affecting the area. Use caution outdoors." },

  { id: 'tropical_depression', tier: 'orange', source: 'manual', effect: 'hurricane', intensity: 1,
    title: "You're Experiencing A Tropical Depression",
    description: "A developing tropical cyclone is present. Prepare if you are in the forecast area." },

  { id: 'hard_freeze', tier: 'orange', source: 'live', effect: 'cold', intensity: 2,
    title: "You're Experiencing A Hard Freeze",
    description: "Extended freezing temperatures are occurring. Protect plumbing and outdoor vegetation." },

  { id: 'wildfire_smoke', tier: 'orange', source: 'live', effect: 'smoke', intensity: 4,
    title: "You're Experiencing Wildfire Smoke",
    description: "Smoke is reducing air quality across the region. Limit outdoor activities." },

  // ===================== DARK ORANGE — #F57C00 =====================
  { id: 'dense_fog', tier: 'darkorange', source: 'live', effect: 'fog', intensity: 4,
    title: "You're Experiencing Dense Fog",
    description: "Visibility has fallen below one-quarter mile. Delay travel if possible. If driving, use low beams and reduce speed." },

  { id: 'scattered_thunderstorms', tier: 'darkorange', source: 'live', effect: 'thunder', intensity: 2,
    title: "You're Experiencing Scattered Thunderstorms",
    description: "Thunderstorms are affecting parts of the area. Monitor weather conditions closely." },

  { id: 'funnel_cloud', tier: 'darkorange', source: 'live-us', effect: 'tornado', intensity: 1,
    title: "You're Experiencing A Funnel Cloud",
    description: "A rotating funnel cloud has developed. Be prepared to take shelter." },

  // ==================== RED (flashing) — #F44336 ====================
  { id: 'freezing_drizzle', tier: 'red', source: 'live', effect: 'rain', intensity: 2, icy: true,
    title: "You're Experiencing Freezing Drizzle",
    description: "Light drizzle is freezing on contact. Roads and sidewalks may become icy." },

  { id: 'freezing_fog', tier: 'red', source: 'live', effect: 'fog', intensity: 3, icy: true,
    title: "You're Experiencing Freezing Fog",
    description: "Fog is depositing ice on exposed surfaces. Travel carefully and watch for black ice." },

  { id: 'sleet', tier: 'red', source: 'approx', effect: 'sleet', intensity: 2,
    title: "You're Experiencing Sleet",
    description: "Ice pellets are falling and creating slippery conditions. Avoid sudden braking or turning while driving." },

  { id: 'wintry_mix', tier: 'red', source: 'approx', effect: 'sleet', intensity: 3,
    title: "You're Experiencing A Wintry Mix",
    description: "Rain, snow, sleet, and freezing rain are occurring together. Travel only if necessary." },

  { id: 'heavy_rain', tier: 'red', source: 'live', effect: 'rain', intensity: 5,
    title: "You're Experiencing Heavy Rain",
    description: "Heavy rainfall may quickly cause flooding. Never drive through flooded roadways." },

  { id: 'heavy_graupel', tier: 'red', source: 'approx', effect: 'hail', intensity: 2,
    title: "You're Experiencing Heavy Graupel",
    description: "Heavy bursts of graupel are reducing visibility. Use caution if outdoors." },

  { id: 'numerous_thunderstorms', tier: 'red', source: 'live', effect: 'thunder', intensity: 3,
    title: "You're Experiencing Numerous Thunderstorms",
    description: "Thunderstorms are widespread. Stay indoors and avoid open areas." },

  { id: 'river_flooding', tier: 'red', source: 'live-us', effect: 'flood', intensity: 2,
    title: "You're Experiencing River Flooding",
    description: "Rivers are overflowing their banks. Avoid flooded areas." },

  { id: 'coastal_flooding', tier: 'red', source: 'live-us', effect: 'flood', intensity: 2,
    title: "You're Experiencing Coastal Flooding",
    description: "Water is inundating coastal areas. Move to higher ground if instructed." },

  { id: 'landspout', tier: 'red', source: 'manual', effect: 'tornado', intensity: 1,
    title: "You're Experiencing A Landspout",
    description: "A weak tornado has formed. Move to an interior room immediately." },

  { id: 'waterspout', tier: 'red', source: 'live-us', effect: 'tornado', intensity: 1,
    title: "You're Experiencing A Waterspout",
    description: "A tornado has formed over the water. Boaters should leave the area immediately." },

  { id: 'ground_blizzard', tier: 'red', source: 'approx', effect: 'snow', intensity: 3, windOverlay: true,
    title: "You're Experiencing A Ground Blizzard",
    description: "Loose snow is being blown by strong winds. Avoid travel if possible." },

  { id: 'high_wind', tier: 'red', source: 'live', effect: 'wind', intensity: 4,
    title: "You're Experiencing High Wind",
    description: "Damaging winds are expected. Stay away from trees and power lines." },

  { id: 'tropical_storm', tier: 'red', source: 'live-us', effect: 'hurricane', intensity: 2,
    title: "You're Experiencing A Tropical Storm",
    description: "A named tropical storm is producing strong winds and heavy rain. Complete storm preparations." },

  { id: 'hurricane_cat1', tier: 'red', source: 'live-us', effect: 'hurricane', intensity: 3,
    title: "You're Experiencing A Category 1 Hurricane",
    description: "A hurricane capable of moderate damage. Follow official guidance." },

  { id: 'extreme_heat', tier: 'red', source: 'live', effect: 'heat', intensity: 3,
    title: "You're Experiencing Extreme Heat",
    description: "Dangerously high temperatures are occurring. Stay hydrated and avoid strenuous activity." },

  { id: 'extreme_cold', tier: 'red', source: 'live', effect: 'cold', intensity: 3,
    title: "You're Experiencing Extreme Cold",
    description: "Dangerously cold temperatures are occurring. Limit outdoor exposure." },

  { id: 'atmospheric_river', tier: 'red', source: 'manual', effect: 'rain', intensity: 5,
    title: "You're Experiencing An Atmospheric River",
    description: "A plume of tropical moisture is producing excessive rainfall. Watch for flooding." },

  // ================== DARK RED (flashing) — #C62828 ==================
  { id: 'blowing_dust', tier: 'darkred', source: 'live', effect: 'dust', intensity: 2,
    title: "You're Experiencing Blowing Dust",
    description: "Strong winds are lifting dust into the air, creating dangerous visibility. Avoid driving into dust clouds. Pull off the road if visibility becomes zero." },

  { id: 'freezing_rain', tier: 'darkred', source: 'live', effect: 'rain', intensity: 3, icy: true,
    title: "You're Experiencing Freezing Rain",
    description: "Rain is freezing instantly on contact. Avoid unnecessary travel." },

  { id: 'heavy_snow', tier: 'darkred', source: 'live', effect: 'snow', intensity: 4,
    title: "You're Experiencing Heavy Snow",
    description: "Heavy snowfall is reducing visibility and accumulating rapidly. Stay off the roads unless absolutely necessary." },

  { id: 'heavy_sleet', tier: 'darkred', source: 'approx', effect: 'sleet', intensity: 4,
    title: "You're Experiencing Heavy Sleet",
    description: "Heavy sleet is making roads extremely hazardous. Avoid unnecessary travel." },

  { id: 'strong_thunderstorms', tier: 'darkred', source: 'live', effect: 'thunder', intensity: 4,
    title: "You're Experiencing Strong Thunderstorms",
    description: "Strong storms may produce damaging wind gusts and hail. Take shelter in a sturdy building." },

  { id: 'large_hail', tier: 'darkred', source: 'live-us', effect: 'hail', intensity: 3,
    title: "You're Experiencing Large Hail",
    description: "Large hail capable of causing damage is falling. Protect yourself and move vehicles under cover." },

  { id: 'damaging_winds', tier: 'darkred', source: 'live-us', effect: 'wind', intensity: 4,
    title: "You're Experiencing Damaging Straight-Line Winds",
    description: "Powerful winds can cause widespread damage. Stay indoors and away from windows." },

  { id: 'windstorm', tier: 'darkred', source: 'live', effect: 'wind', intensity: 5,
    title: "You're Experiencing A Windstorm",
    description: "Widespread damaging winds are occurring. Remain indoors if possible." },

  { id: 'severe_tropical_storm', tier: 'darkred', source: 'manual', effect: 'hurricane', intensity: 2,
    title: "You're Experiencing A Severe Tropical Storm",
    description: "An unusually intense tropical storm is affecting the area. Follow local emergency guidance." },

  { id: 'hurricane_cat2', tier: 'darkred', source: 'live-us', effect: 'hurricane', intensity: 4,
    title: "You're Experiencing A Category 2 Hurricane",
    description: "A hurricane capable of extensive damage. Complete preparations immediately." },

  { id: 'heat_wave', tier: 'darkred', source: 'approx', effect: 'heat', intensity: 4,
    title: "You're Experiencing A Heat Wave",
    description: "Several days of dangerous heat are expected. Check on vulnerable individuals." },

  { id: 'cold_wave', tier: 'darkred', source: 'approx', effect: 'cold', intensity: 4,
    title: "You're Experiencing A Cold Wave",
    description: "A prolonged period of unusually cold weather. Dress in layers and protect pipes." },

  // =================== CRIMSON (flashing) — #B71C1C ===================
  { id: 'sandstorm', tier: 'crimson', source: 'manual', effect: 'dust', intensity: 4,
    title: "You're Experiencing A Sandstorm",
    description: "Blowing sand has created extremely dangerous travel conditions. Stay indoors if possible and avoid travel." },

  { id: 'heavy_freezing_rain', tier: 'crimson', source: 'live', effect: 'rain', intensity: 4, icy: true,
    title: "You're Experiencing Heavy Freezing Rain",
    description: "Significant ice accumulation is occurring. Stay indoors and avoid travel." },

  { id: 'severe_thunderstorms', tier: 'crimson', source: 'live', effect: 'thunder', intensity: 5,
    title: "You're Experiencing Severe Thunderstorms",
    description: "Severe thunderstorms capable of destructive winds and large hail are occurring. Seek shelter immediately and stay away from windows." },

  { id: 'downburst', tier: 'crimson', source: 'live-us', effect: 'wind', intensity: 5,
    title: "You're Experiencing A Downburst",
    description: "Localized destructive winds are occurring. Take shelter immediately." },

  { id: 'microburst', tier: 'crimson', source: 'live-us', effect: 'wind', intensity: 5,
    title: "You're Experiencing A Microburst",
    description: "An intense burst of wind is causing dangerous conditions. Remain inside until the storm passes." },

  { id: 'weak_tornado', tier: 'crimson', source: 'live-us', effect: 'tornado', intensity: 2,
    title: "You're Experiencing A Weak Tornado",
    description: "A tornado capable of localized damage is occurring. Take shelter immediately." },

  { id: 'dust_storm', tier: 'crimson', source: 'live', effect: 'dust', intensity: 5,
    title: "You're Experiencing A Dust Storm",
    description: "Heavy blowing dust is creating near zero visibility. Avoid driving into dust storms." },

  // ==================== PURPLE (flashing) — #8E24AA ====================
  { id: 'giant_hail', tier: 'purple', source: 'live-us', effect: 'hail', intensity: 5,
    title: "You're Experiencing Giant Hail",
    description: "Extremely large hail poses a serious danger to life and property. Take immediate shelter." },

  { id: 'flash_flooding', tier: 'purple', source: 'live', effect: 'flood', intensity: 4,
    title: "You're Experiencing Flash Flooding",
    description: "Flooding is occurring rapidly. Move to higher ground immediately." },

  { id: 'strong_tornado', tier: 'purple', source: 'live-us', effect: 'tornado', intensity: 3,
    title: "You're Experiencing A Strong Tornado",
    description: "A dangerous tornado capable of major destruction is occurring. Go to a basement or small interior room immediately." },

  { id: 'blizzard', tier: 'purple', source: 'approx', effect: 'snow', intensity: 5, windOverlay: true,
    title: "You're Experiencing A Blizzard",
    description: "Heavy snow and strong winds have created whiteout conditions. Stay indoors." },

  { id: 'hurricane_cat3', tier: 'purple', source: 'live-us', effect: 'hurricane', intensity: 5,
    title: "You're Experiencing A Category 3 Major Hurricane",
    description: "A major hurricane causing devastating damage. Evacuate if instructed." },

  { id: 'bomb_cyclone', tier: 'purple', source: 'live', effect: 'hurricane', intensity: 4,
    title: "You're Experiencing A Bomb Cyclone",
    description: "A rapidly strengthening storm is impacting the area. Prepare for severe weather conditions." },

  { id: 'polar_vortex', tier: 'purple', source: 'approx', effect: 'cold', intensity: 5,
    title: "You're Experiencing A Polar Vortex Outbreak",
    description: "Extreme Arctic air has spread across the region. Stay indoors when possible." },

  // ================= DARK PURPLE (flashing) — #4A148C =================
  { id: 'violent_tornado', tier: 'darkpurple', source: 'live-us', effect: 'tornado', intensity: 4,
    title: "You're Experiencing A Violent Tornado",
    description: "A violent tornado is causing catastrophic damage. Seek underground shelter immediately." },

  { id: 'ice_storm', tier: 'darkpurple', source: 'live-us', effect: 'rain', intensity: 4, icy: true,
    title: "You're Experiencing An Ice Storm",
    description: "Dangerous ice accumulation is occurring. Stay indoors and prepare for power outages." },

  { id: 'hurricane_cat4', tier: 'darkpurple', source: 'live-us', effect: 'hurricane', intensity: 5,
    title: "You're Experiencing A Category 4 Major Hurricane",
    description: "An extremely dangerous hurricane. Follow evacuation orders immediately." },

  { id: 'derecho', tier: 'darkpurple', source: 'manual', effect: 'wind', intensity: 5,
    title: "You're Experiencing A Derecho",
    description: "A long-lived destructive windstorm is occurring. Take shelter indoors immediately." },

  { id: 'historic_flooding', tier: 'darkpurple', source: 'live-us', effect: 'flood', intensity: 5,
    title: "You're Experiencing Historic Flooding",
    description: "Flooding of exceptional magnitude is occurring. Move to higher ground immediately." },

  // ======================= BROWN (flashing) — #6D4C41 =======================
  // No conditions were specified for this tier in the brief. It's fully
  // wired up (color + test menu group, flashing like the other severe tiers)
  // — add entries here any time.

  // ==================== MAROON (flashing) — #800000 ====================
  { id: 'volcanic_ash', tier: 'maroon', source: 'manual', effect: 'ash', intensity: 3,
    title: "You're Experiencing Volcanic Ash",
    description: "Volcanic ash is reducing visibility and creating hazardous air quality. Remain indoors and follow official emergency instructions." },

  { id: 'tornado_emergency', tier: 'maroon', source: 'live-us', effect: 'tornado', intensity: 5,
    title: "You're Experiencing A Tornado Emergency",
    description: "A violent tornado is impacting a populated area. This is life threatening. Take shelter immediately." },

  { id: 'extreme_blizzard', tier: 'maroon', source: 'approx', effect: 'snow', intensity: 5, windOverlay: true,
    title: "You're Experiencing An Extreme Blizzard",
    description: "Life threatening blizzard conditions exist. Avoid all travel and remain indoors." },

  { id: 'hurricane_cat5', tier: 'maroon', source: 'live-us', effect: 'hurricane', intensity: 5,
    title: "You're Experiencing A Category 5 Major Hurricane",
    description: "A catastrophic hurricane is occurring. Evacuate immediately if ordered." },

  { id: 'catastrophic_ice_storm', tier: 'maroon', source: 'live-us', effect: 'rain', intensity: 5, icy: true,
    title: "You're Experiencing A Catastrophic Ice Storm",
    description: "Extreme ice accumulation is causing widespread impacts. Remain indoors and avoid all travel." },

  { id: 'hurricane_cat5_landfall', tier: 'maroon', source: 'live-us', effect: 'hurricane', intensity: 5,
    title: "You're Experiencing Category 5 Hurricane Landfall",
    description: "A Category 5 hurricane is making landfall. Follow emergency instructions immediately." },

  { id: 'ef5_tornado', tier: 'maroon', source: 'manual', effect: 'tornado', intensity: 5,
    title: "You're Experiencing A Violent EF5 Tornado",
    description: "An EF5 tornado (measured with winds, not damage) is causing catastrophic destruction. Take underground shelter immediately." },

  { id: 'tornado_outbreak', tier: 'maroon', source: 'live-us', effect: 'tornado', intensity: 5,
    title: "You're Experiencing A Tornado Outbreak",
    description: "Multiple tornadoes are occurring across the region. Stay weather aware and be prepared to shelter at any time." },

  { id: 'hurricane_tornado_outbreak', tier: 'maroon', source: 'live-us', effect: 'multi', intensity: 5,
    title: "You're Experiencing A Hurricane w/ Tornado Outbreak",
    description: "A hurricane is producing numerous tornadoes. Follow all hurricane and tornado safety instructions." },

  { id: 'catastrophic_multi_hazard', tier: 'maroon', source: 'live-us', effect: 'multi', intensity: 5,
    title: "You're Experiencing A Catastrophic Multi-Hazard Event",
    description: "Multiple life threatening weather hazards are occurring simultaneously. Follow all emergency instructions immediately." }

];

const CONDITIONS_BY_ID = {};
WEATHER_CONDITIONS.forEach(function (c) { CONDITIONS_BY_ID[c.id] = c; });

// Works as a plain <script> global (browser) and as a CommonJS module (node,
// for the validation script in test/validate-data.js).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WEATHER_TIERS, WEATHER_CONDITIONS, CONDITIONS_BY_ID, TIER_ORDER, tierRank };
}
