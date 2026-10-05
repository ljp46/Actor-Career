# Second Take

A mobile-first alternate-history actor life sim. Start on your fourth birthday, audition inside a living film/TV world, change casting history, build a family and relationships, spend career earnings, and continue into procedurally generated future decades.

## Historical world

The game is designed around a year-sharded real-world catalogue from **1960 through 2026**. The data/years folder can contain every imported film/TV production and every credited acting role with a named character for each year. Only the years around the current in-game date are loaded into the browser, so a large catalogue remains practical on a phone.

All 67 imported years are installed as lossless `.json.gz` files, with a complete year and audition-opportunity index. The original full JSON files and all monthly checkpoints remain on `maintenance/historical-database-36386406355`. The browser decompresses only the nearby years it needs. Separate productions sharing a title remain distinct.

Each imported role stores real production metadata, the historical performer and birth year where available, a separate role gender used as a hard casting constraint, flexible playing-age bounds, and source metadata so imported defaults can be corrected without changing the engine.

TMDB exposes performer gender rather than a definitive character-gender field. The bulk importer therefore seeds role gender from the canonical performer and records genderSource as canonical_performer. Exceptional voice, disguise or cross-gender roles can be corrected as data overrides later; the engine itself treats an explicit role gender as a hard eligibility rule.

## Building the 1960–2026 database

The 1960–2026 import has finished. The old full-year workflow is paused; future imports should use resumable monthly batches on the recovery branch. Do not paste a TMDB credential into code or commit it.

`scripts/pack_catalogue.py` builds the full index and lossless compressed runtime files from validated year JSON. `scripts/audit_catalogue.js` checks the compressed files, manifest totals, and every matching role across film/TV casting profiles for all 67 years before publication.

Auditions include all undecided roles meeting the 35% minimum fit and gender rule in their casting year. Search and 20-role pages let players reach the entire eligible list; there is no twelve-role cap. A successful casting removes other roles in the same production for that player.
The browser never receives the API token.

## Gender-aware casting

New characters choose Male, Female or Non-binary at creation. A role with a known gender is not shown as an audition unless the character gender matches. Gender is also applied to competing audition shortlists, generated actors after 2026, family casting and descendants. Old saves are migrated safely and prompt once for the active character's gender before auditions resume.

Age remains flexible rather than exact: an adult actor can still have a strong fit for a teenage character when their playing age is plausible.

## Living world

The World tab shows productions around the current year even when the player is not involved. It supports search across productions, actors, characters and directors/creators and paginates results for mobile performance. Save-specific cast changes are displayed in place of real history while retaining the original performer underneath.

Casting years and playing-age windows are game abstractions unless an imported source explicitly provides better production timing. They should not be read as claims about the exact historical audition date.

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

