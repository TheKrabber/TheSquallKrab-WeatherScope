# TheSquallKrab - WeatherScope

A weather dashboard for GitHub Pages. It finds you by IP address (or a ZIP/postal
code you type in), pulls live conditions, and shows them as one of 90 animated,
color-coded states — from "Your Skies Are Clear" (calm green) up through
"You're Experiencing A Catastrophic Multi-Hazard Event" (flashing maroon).

No backend, no build step, no API keys. It's four files that run entirely in
the visitor's browser.

<br>

## 1. What's in this repo

| File | What it is |
|---|---|
| `index.html` | Page structure — the two banners, the animated box, the location bar, the test menu. |
| `styles.css` | All layout, colors, and the CSS animations for every effect (rain, snow, fog, tornado, hurricane, etc). |
| `weatherData.js` | Data only: all 90 conditions — title, description, tier color, which animation they use, and how they can be detected. Edit **this** file to change wording or colors. |
| `app.js` | All the logic: location lookup, fetching weather/air-quality/alerts, deciding which of the 90 conditions to show, and drawing the animations. |
| `test/` | Optional. A data-integrity checker and a small automated test suite for the decision logic. Not needed for the site to run — see [Running the checks](#4-optional-run-the-automated-checks). |
| `package.json`, `.gitignore` | Only relevant because `test/` is in it. Not needed for the live site itself. |

You don't need a server, a database, or a build tool. GitHub Pages just serves
these files as-is.

<br>

## How it decides what to show

Everything is free and needs no API key. Here's every source, and exactly
what it's used for:

| Source | Used for | Coverage |
|---|---|---|
| [BigDataCloud reverse-geocode-client](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) | Default IP-based location | Worldwide |
| [ipapi.co](https://ipapi.co/) / [ipwho.is](https://ipwho.is/) | Backup IP location, only if BigDataCloud fails | Worldwide |
| [OpenStreetMap Nominatim](https://nominatim.org/) | Turning a typed ZIP/postal code into coordinates | Wherever OpenStreetMap has postal-code data (varies a lot by country — see below) |
| [Open-Meteo Forecast API](https://open-meteo.com/) | Temperature, wind, pressure, precipitation type/rate, cloud cover, visibility, UV index, CAPE (storm energy), snow depth | Worldwide (global weather models) |
| [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | AQI stat, plus Haze/Smoke/Wildfire Smoke/Blowing Dust/Dust Storm | Worldwide, but resolution is coarser outside the US/Europe |
| [api.weather.gov (NWS)](https://www.weather.gov/documentation/services-web-api) | Every named severe-weather condition — tornadoes, hurricanes, blizzards, ice storms, flood warnings, etc. | **United States and its territories only** (Puerto Rico, Guam, USVI, American Samoa, N. Mariana Islands) |

Every ~10 minutes (while the tab is visible), it re-fetches and re-checks.
The `app.js` file header has this same list as a code comment, and
`weatherData.js`'s header explains the `source` tag on each condition.

### How one condition gets picked out of 90

The site gathers candidates from every check above (sky condition, current
precipitation, wind speed, storm energy, temperature extremes, air quality,
active NWS alerts, etc.) and shows whichever one belongs to the **most
severe color tier**. So if it's both breezy *and* about to have a Tornado
Warning, you see the tornado, not the breeze — an official NWS alert always
outranks a heuristic guess.

<br>

## Where this won't work

### By country

- **Location and core weather** (sky, rain/snow, temperature, wind,
  pressure, UV, fog/visibility, thunderstorm risk, air quality) — works
  anywhere in the world. Accuracy varies with how good the underlying
  weather models are for that region, same as any weather app.
- **ZIP/postal code lookup** — depends entirely on OpenStreetMap's postal
  code data for that country. It's generally solid for the US, Canada, UK,
  Germany, France, and most of the EU/Australia, and patchier elsewhere. If
  a lookup fails, the site tells you and suggests "Use my location" instead.
- **Every named severe-weather condition** (tornadoes, hurricanes, blizzards,
  ice storms, official flood/high-wind warnings, the outbreak/multi-hazard
  detection) — **United States and territories only.** This is the single
  biggest limitation: 27 of the 90 conditions are reachable *only* through a
  live NWS alert, so outside the US they will never appear on their own —
  only from the test menu. Other countries have their own agencies (Environment
  Canada, the UK Met Office, JMA, BOM, etc.) that this site doesn't
  integrate with; wiring one of those in for your region would be a
  reasonable next step if you want to extend it.

### 9 conditions that never trigger automatically, anywhere

These are fully built — correct color, title, description, and animation,
all reachable from the test menu — but nothing about them is knowable from
free, real-time data, so `app.js` never claims to detect them on its own:

- **A Violent EF5 Tornado** — this is the clearest example of why: the
  "EF5" rating is assigned by National Weather Service damage-survey teams
  *after* a tornado ends, from studying the destruction. There's no way to
  know a tornado is EF5 while it's happening.
- **A Tropical Disturbance**, **A Tropical Depression**, **A Severe Tropical
  Storm** — these are official classifications from tropical-cyclone forecast
  centers (like the NHC) that aren't exposed as a simple public alert feed.
- **A Landspout**, **An Atmospheric River**, **A Derecho**, **A Sandstorm** —
  each describes a specific structure or scale of event (a rotating weak
  tornado not tied to a supercell; a long, moisture-dense corridor; wind
  damage stretching 400+ miles; a sand- vs. dust-specific storm) that isn't
  distinguishable from a single point's weather readings.
- **Volcanic Ash** — needs an active eruption and ashfall advisory from a
  Volcanic Ash Advisory Center, which isn't part of any source this site uses.

### 11 more that are "approximate," not the real thing

`weatherData.js` tags these `source: 'approx'`. They do trigger
automatically, but from a rough stand-in rather than an official
determination — worth knowing if you rely on them:

Frost, Sleet, A Wintry Mix, Heavy Graupel, A Ground Blizzard, Heavy Sleet, A
Heat Wave, A Cold Wave, A Blizzard, A Polar Vortex Outbreak, An Extreme
Blizzard.

For example, "A Polar Vortex Outbreak" here just means *"the apparent
temperature is below −30°F"* — not a confirmed stratospheric polar vortex
disruption. "A Blizzard" is triggered by wind + falling snow + low visibility
all at once, which is close to the official definition but doesn't check the
3-hour duration requirement real Blizzard Warnings use. Rain/snow/sleet
typing (Sleet vs. Wintry Mix vs. plain Snow) is nudged by surface
temperature alone, when properly telling them apart really needs a
vertical temperature profile through the atmosphere.

The other 70 conditions (`live` and `live-us`) are either detected from
a direct, named data field (a specific weather code, an NWS alert type) or
a plain physical threshold with real meteorological backing — for instance,
"A Bomb Cyclone" checks for an actual 24 hPa pressure drop in 24 hours,
which is the real definition of bombogenesis.

<br>

## Attribution

Two of the free sources ask for visible credit, which the location bar
already includes ("Postal lookup via OpenStreetMap Nominatim · IP location
via BigDataCloud"). If you remove or restyle that line, please keep some
form of attribution for [OpenStreetMap](https://www.openstreetmap.org/copyright)
and BigDataCloud — it's a condition of using their free tiers, not just a
nicety.

Nominatim in particular is a small, volunteer-run public instance with a
soft cap of about one request per second and a request not to hammer it
automatically — this site only calls it when you click "Go" on a ZIP code,
never on every keystroke, which keeps it well within that limit for normal
personal use.
