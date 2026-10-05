# Second Take

A mobile-first alternate-history actor life sim. Choose a birthday and starting date, audition inside a living film/TV world, change casting history, build a family and relationships, spend career earnings, and continue into procedurally generated future decades.

## Historical world

The game is designed around a year-sharded real-world catalogue from **1960 through 2026**. The playable selection contains up to **100 films and 30 new TV series per release year**, ranked by saved TMDB audience vote count, with stored popularity breaking ties. This aims for recognisable blockbusters, popular independent films and cult favourites. Every named role in each selected production remains intact. Only nearby years and pending bookings are loaded.

All 67 selected years are installed as `.json.gz` files with an opportunity index. Complete original shards are preserved in `data/archive/years`, while raw JSON and monthly checkpoints remain on `maintenance/historical-database-36386406355`. Archived files are loaded only to finish an ongoing booking from an older save whose title is outside the new selection; unrelated archived productions do not become auditions. Separate productions sharing a title remain distinct.

`scripts/curate_catalogue.py` regenerates the selection from the saved archive without contacting TMDB. `FILM_LIMIT` and `TV_LIMIT` control the allowances. The index records selection counts and compressed-file hashes.

Each imported role stores real production metadata, the historical performer and birth year where available, a separate role gender used as a hard casting constraint, flexible playing-age bounds, and source metadata so imported defaults can be corrected without changing the engine.

TMDB exposes performer gender rather than a definitive character-gender field. The bulk importer therefore seeds role gender from the canonical performer and records genderSource as canonical_performer. Exceptional voice, disguise or cross-gender roles can be corrected as data overrides later; the engine itself treats an explicit role gender as a hard eligibility rule.

## Building the 1960–2026 database

The 1960–2026 import has finished. The old full-year workflow is paused; future imports should use resumable monthly batches on the recovery branch. Do not paste a TMDB credential into code or commit it.

`scripts/pack_catalogue.py` builds the full index and lossless compressed runtime files from validated year JSON. `scripts/audit_catalogue.js` checks the compressed files, manifest totals, and every matching role across film/TV casting profiles for all 67 years before publication.

Auditions include all undecided roles in selected productions meeting the 35% minimum fit and gender rule while their casting window is open. Search and 20-role pages let players reach the entire eligible list; there is no twelve-role cap. A successful casting removes other roles in the same production for that player.
The browser never receives the API token.

## Gender-aware casting

New characters choose Male, Female or Non-binary at creation. A role with a known gender is not shown as an audition unless the character gender matches. Gender is also applied to competing audition shortlists, generated actors after 2026, family casting and descendants. Old saves are migrated safely and prompt once for the active character's gender before auditions resume.

Age remains flexible rather than exact: an adult actor can still have a strong fit for a teenage character when their playing age is plausible.

## Starting dates and cheats

New lives accept a birth date (1900–2100) and an independent starting date (1960–2199), provided the actor is at least four. Age-four and age-eighteen shortcuts are available. Starting later begins a fresh career without simulating missed childhood.

Settings → Cheats has separate buttons to maximise acting, drama and comedy. Select one known person or all known castmates, then separately maximise friendship, professional respect or romantic chemistry. Romantic chemistry retains adult and family restrictions; it does not automatically create a dating relationship. Cheats save immediately and do not consume weekly activities.

Each eligible audition also has a **Force win (cheat)** button. It guarantees that specific role using the normal booking, filming, payment and release flow. **Attend audition** retains the normal weighted chance; using the cheat does not change future auditions. Casting windows, age/gender fit and shoot conflicts still apply.

## Living world

The World tab shows productions around the current year even when the player is not involved. It supports search across productions, actors, characters and directors/creators and paginates results for mobile performance. Save-specific cast changes are displayed in place of real history while retaining the original performer underneath.

Casting opens before a shoot and closes when filming begins. TMDB provides release/first-air dates, but the bulk catalogue does not provide reliable filming windows. The game estimates a 10–22 week shoot according to format and project scale, places it ahead of release, then opens casting 20–26 weeks beforehand. These dates are labelled **estimated** in the game and are not historical filming claims. An explicit `filmingStartDate`, `filmingEndDate`, or `castingStartDate` in a project can override the estimate.

Time advances in seven-day steps. A won part is booked, enters filming, pays at wrap, and gains release fame only when audiences can see it. Overlapping shoots block conflicting auditions. Existing monthly saves open on the last day of their saved month and retain their existing career credits and money.

The People screen exposes credited co-stars once a part is booked. During filming, you can hang out between takes; adult characters can build chemistry, date, and suggest a consensual off-screen hookup. Interactions are fictional and limited by weekly social time. Rest, exercise, going out, and acting practice use separate weekly activity slots. The World screen shows the full imported named cast; crew credits are displayed when present in a shard. The importer's crew field will appear on a future rebuild, because an already running workflow keeps the script version it started with.

Production schedules are cached, booked-project lookups use IDs, and family actors receive at most two non-overlapping projects per release year (family directors at most one). These limits avoid enormous family filmographies. Existing credits are retained.

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
python -m unittest discover -s tests -p 'test_*.py'
python -m py_compile scripts/*.py
~~~

GitHub Actions runs both checks on pushes and pull requests.
