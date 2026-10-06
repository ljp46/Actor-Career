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

Each eligible audition also has a **Force win (cheat)** button. In v1.2 this guarantees a non-binding offer for that specific role; explicitly accept it to book the shoot. **Attend audition** retains normal chance-based shortlisting and callbacks. Casting windows, age/gender fit and shoot conflicts still apply.

## v1.2: career choices and franchise commitments

Rehearse scripts or pay for coaching before auditions and callbacks. Choose an agent, compare competing offers, negotiate fees and decide which shoot to accept. Agents earn commission on agreed fees at wrap; changing representation does not erase an existing commission agreement.

On set, balance extra rehearsal, cast teamwork and recovery. Fictional production dilemmas can create difficult working conditions. Performance and simulated audience reception affect professional reputation and fame; these outcomes are alternate-history gameplay, not claims about real films or people.

TMDB collections link real film franchises. Optional multi-film deals reserve up to two future appearances of the same uniquely matched, named character, using original full-cast role indices. Returns are binding and do not require new auditions: honour the offer or leave the contract. Refusal or missed deadlines reduce reputation and affect future audition prospects. Poor reception, script concerns and unfair demands can make leaving worthwhile.

The compact startup index contains recurring character links only. Excluded franchise productions are fetched individually when needed for a signed return, rather than loading the complete archive. Ordinary auditions still use the curated 100-film/30-TV yearly selection. Long-gap revivals, same-title remakes and ambiguous character matches are not promised as contract returns.

Existing v1 saves migrate in place; already released credits do not receive retroactive performance rewards. Relationship redesign remains deferred.

## v1.3: TV seasons and alternate character futures

The initial v1.3 data pass contains 8,576 dated seasons and 592,937 character credits across the 2,010 curated TV shows. The startup index is 142,531 bytes; detailed character histories load only for shows the player has joined. Curated shows use season-specific TMDB aggregate casts, including guest and recurring characters and credited episode counts. Series-level latest-cast lists are replaced where season data is available, and seasonal shards load alongside nearby film years.

Accepting a TV role starts a series career. A uniquely matched returning character receives next-season offers without auditioning again. Accept a return, leave the series voluntarily, or allow its offer to expire. Already filming seasons continue; leaving affects future work. Guest appearances remain labelled as guest credits. A character absent from the next verified cast has no promised return, and ambiguous character matches are never treated as certain continuity.

Strong performances and audience attachment can change a character departure, win an alternate renewal, or inspire a new film-sequel appearance. Leaving a popular role can contribute to earlier cancellation. These decisions are saved once and their chances are hidden. Alternate productions and story changes are clearly marked as fictional; shared real-world casts are preserved.

TMDB credits do not prove a character died or a series was cancelled for a particular reason. Explicit deaths use sourced entries in data/continuity-overrides.json, including JJ's season-four departure in Outer Banks. Other missing appearances are described as departures without invented causes. Flashbacks or visions do not establish an ongoing living role. Data gaps and unknown future dates are not fabricated as real history; continuing beyond the dated catalogue is explicitly alternate timeline gameplay.

scripts/build_tv_seasons.py builds checkpointed season data using the configured TMDB credential. scripts/audit_tv.js checks every seasonal shard and role index. Existing series-level bookings keep their original payment and release flow during migration. Filming windows are estimates, not episode-level historical shoot records.

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

GitHub Actions runs unit checks on pushes and pull requests. Main, feature branches and pull requests also audit the full selected catalogue and franchise links, then run Chromium checks for auditions, contracts, recurring TV seasons, legacy saves and an eight-year performance playthrough.
