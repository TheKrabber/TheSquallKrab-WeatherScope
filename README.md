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
| `package.json`, `.gitignore` | Only relevant if you use `test/`. Not needed for the live site itself. |

You don't need a server, a database, or a build tool. GitHub Pages just serves
these files as-is.

<br>

## 2. Get this onto GitHub

### Option A — GitHub's website (no command line needed)

1. Go to [github.com](https://github.com) and log in.
2. Click the **+** in the top-right corner → **New repository**.
3. Name it something like `weather-scope`. Keep it **Public** (GitHub Pages'
   free tier needs a public repo, unless you're on a paid plan). Don't
   initialize it with a README — you already have one.
4. Click **Create repository**.
5. On the new repo's page, click **uploading an existing file**.
6. Drag in `index.html`, `styles.css`, `weatherData.js`, `app.js`, and
   `README.md` (and `test/`, `package.json`, `.gitignore` if you want them
   too — they're harmless either way).
7. Scroll down, click **Commit changes**.

### Option B — Git on the command line

```bash
cd path/to/this/folder
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/weather-scope.git
git push -u origin main
```

<br>

## 3. Turn on GitHub Pages

1. In your repo, go to **Settings** → **Pages** (left sidebar, under "Code and automation").
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose **main** and folder **/ (root)**, then **Save**.
4. Wait a minute or two. Refresh the page — GitHub will show you the live URL,
   something like:

   `https://YOUR-USERNAME.github.io/weather-scope/`

That's the whole deployment. Any time you push new commits to `main`, the
live site updates automatically within a minute or so.

<br>

## 4. Test it locally first (recommended)

Before pushing, you can just double-click `index.html` to open it in a
browser — the weather APIs this site uses all allow being called directly
from a page like that, so it should work. If your browser is picky about
that, run a tiny local server instead from inside the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

<br>

## 5. (Optional) Run the automated checks

`test/` has two independent checks:

- **`test/validate-data.js`** — plain Node, no dependencies. Confirms all 90
  entries in `weatherData.js` are well-formed (valid colors, no duplicate
  ids, no leftover "Your Experiencing" typos, etc). Run with:
  ```bash
  node test/validate-data.js
  ```
- **`test/run-jsdom-tests.js`** — exercises the actual decision logic (the
  functions that turn raw weather numbers into one of the 90 conditions)
  against ~66 synthetic scenarios, using [jsdom](https://github.com/jsdom/jsdom)
  to simulate a browser. Needs one dependency:
  ```bash
  npm install
  npm test
  ```

Neither is required for the site to work — they're just there so you can
change thresholds or add conditions later without breaking things silently.

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

## Customizing

- **Removing the test menu** (e.g. for a "production" version) — every part
  of it is wrapped in matching `DEV PANEL: START` / `DEV PANEL: END` comments
  in `index.html`, `styles.css`, and `app.js`. The only one that actually
  matters is **`index.html`**: `app.js` checks whether `#test-menu-toggle`
  exists before wiring anything up, so deleting just that HTML block is
  enough to safely turn the panel off — nothing else will throw or break.
  Trimming the matching blocks from `styles.css`/`app.js` too is optional
  cosmetic cleanup (smaller files), not required. **To put it back**, paste
  those same blocks back in (keep a copy somewhere before deleting, or pull
  them from git history / from the copy of this project you already have).
- **Wording, colors, which animation a condition uses** — all in
  `weatherData.js`. Each entry is one object; `effect` picks the animation
  (`rain`, `snow`, `tornado`, `hurricane`, etc. — see the comment block at
  the top of `app.js` for the full list), `intensity` (1–5, or 1–6 for
  `sky`) controls how strong it looks.
- **Amber (`#FFC107`) and Brown (`#6D4C41`)** — your original list didn't
  assign any conditions to these two tiers, so they're fully wired up
  (color, flashing behavior for Brown, test-menu grouping) but empty. Add
  entries the same way as any other tier and they'll show up automatically.
- **Detection thresholds** (what counts as "windy" vs. "very windy," what
  temperature counts as "extreme cold," etc.) — the `THRESH` object near the
  top of `app.js`.
- **The NWS alert → condition mapping** (which alert text maps to which of
  the 90 conditions) — `mapNwsAlertToConditionId()` in `app.js`.

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

<br>

## A few small edits I made to your spec

- "Your Experiencing X" → "You're Experiencing X" throughout (contraction of
  "you are"), everywhere it appeared. "Your Skies Are Clear" / "Your Area Is
  Windy" were already correct as written and untouched.
- "A Atmospheric River" / "A Ice Storm" / "A Extreme Blizzard" → "An
  Atmospheric River" / "An Ice Storm" / "An Extreme Blizzard."
- A handful of typos in the description text (abundant/sunshine, outdoor,
  activities, coastal/inundating, unusually, precautions).
- Amber and Brown are in the code with no conditions, as noted above, since
  none were specified.

Everything else — every title, every description, every color, the full
list of 90 conditions — is exactly as you wrote it.
