# Second Take

A mobile-first alternate-history actor life sim. Start on your fourth birthday, audition inside a living film/TV world, change casting history, build a family and relationships, spend career earnings, and continue into procedurally generated future decades.

## Historical world

The game is designed around a year-sharded real-world catalogue from **1960 through 2026**. The data/years folder can contain every imported film/TV production and every credited acting role with a named character for each year. Only the years around the current in-game date are loaded into the browser, so a large catalogue remains practical on a phone.

Until those shards are built, data/sample.json is the fallback demonstration catalogue. The New Life screen reports whether the full historical database, a partial database, or only the sample is installed.

Each imported role stores real production metadata, the historical performer and birth year where available, a separate role gender used as a hard casting constraint, flexible playing-age bounds, and source metadata so imported defaults can be corrected without changing the engine.

TMDB exposes performer gender rather than a definitive character-gender field. The bulk importer therefore seeds role gender from the canonical performer and records genderSource as canonical_performer. Exceptional voice, disguise or cross-gender roles can be corrected as data overrides later; the engine itself treats an explicit role gender as a hard eligibility rule.

## Building the 1960–2026 database

Do **not** paste a TMDB credential into code or commit it. Add a repository Actions secret named TMDB_TOKEN, then run **Actions → Build Historical Database → Run workflow**. The default hollywood scope imports films with US release data plus US-origin TV; worldwide is available if the game is later expanded beyond Hollywood.

The workflow builds all 67 year shards (1960–2026), keeps the complete credited cast rather than only headline roles, rebuilds the compact audition-opportunity index, and commits the generated shards. It also runs every three months so imported TMDB data is refreshed rather than becoming a permanent stale cache.

The browser never receives the API token.

## Gender-aware casting

New characters choose Male, Female or Non-binary at creation. A role with a known gender is not shown as an audition unless the character gender matches. Gender is also applied to competing audition shortlists, generated actors after 2026, family casting and descendants. Old saves are migrated safely and prompt once for the active character's gender before auditions resume.

Age remains flexible rather than exact: an adult actor can still have a strong fit for a teenage character when their playing age is plausible.

## Living world

The World tab shows productions around the current year even when the player is not involved. It supports search across productions, actors, characters and directors/creators and paginates results for mobile performance. Save-specific cast changes are displayed in place of real history while retaining the original performer underneath.

Casting opens before a shoot and closes when filming begins. TMDB provides release/first-air dates, but the bulk catalogue does not provide reliable filming windows. The game estimates a 10–22 week shoot according to format and project scale, places it ahead of release, then opens casting 20–26 weeks beforehand. These dates are labelled **estimated** in the game and are not historical filming claims. An explicit `filmingStartDate`, `filmingEndDate`, or `castingStartDate` in a project can override the estimate.

Time advances in seven-day steps. A won part is booked, enters filming, pays at wrap, and gains release fame only when audiences can see it. Overlapping shoots block conflicting auditions. Existing monthly saves open on the last day of their saved month and retain their existing career credits and money.

The People screen exposes credited co-stars once a part is booked. During filming, you can hang out between takes; adult characters can build chemistry, date, and suggest a consensual off-screen hookup. Interactions are fictional and limited by weekly social time. Rest, exercise, going out, and acting practice use separate weekly activity slots. The World screen shows the full imported named cast; crew credits are displayed when present in a shard. The importer's crew field will appear on a future rebuild, because an already running workflow keeps the script version it started with.

Imported TV entries currently use series launch data and series-level credits. Season-specific filming, guest roles, and joining or leaving the cast in later seasons need a separate season data pass.

## Future timeline

From 2027 onward, the world generates new films, TV series, actors, directors and roles indefinitely. Generated roles also have gender and playing-age requirements. Names and titles are checked against the save's persistent registries to avoid recycling identities already used in that universe.

## Local play

~~~bash
python3 -m http.server 8080
~~~

Open http://localhost:8080. GitHub Pages can publish the repository root from main. On iPhone, open the HTTPS page in Safari and add it to the Home Screen. Save data lives on-device; Settings → Export save creates a backup.

## Data and attribution

Imported historical catalogue data comes from TMDB. The in-game Settings/Credits view includes TMDB's approved logo and required notice. This project does not claim exact historical casting windows where they are not available.

Relationship events, alternate castings and memorial tributes involving public figures are fictional game outcomes, not statements about their private lives or words they actually said. This is an independent fan-made project and is unaffiliated with Hollywood Talent Tycoon or any studio.

## Tests

~~~bash
node --test --experimental-default-type=module tests/*.test.js
python -m py_compile scripts/*.py
~~~

GitHub Actions runs both checks on pushes and pull requests.
