# Historical catalogue import

Second Take stores historical data in one JSON shard per year so a 1960–2026 catalogue does not have to be loaded into a phone at once.

## Recommended: GitHub Actions

1. Obtain a TMDB API Read Access Token for the project.
2. In the GitHub repository, add it as an Actions secret named TMDB_TOKEN. Never commit it or put it in client-side JavaScript.
3. Open **Actions → Build Historical Database → Run workflow**.
4. Keep the default hollywood scope for the intended game world, or choose worldwide if deliberately expanding beyond Hollywood.

The workflow imports 1960–2026, builds data/years/index.json, and commits the generated shards. It is also scheduled quarterly so cached TMDB-derived data is refreshed.

## Local importer

~~~bash
export TMDB_TOKEN='your token here'
python3 scripts/import_tmdb.py --start 1960 --end 2026 --scope hollywood
python3 scripts/build_manifest.py
~~~

By default the importer does **not** cap discovery pages or cast size. For a quick development run only, use --max-pages N or --cast-limit N.

The importer discovers films by release window and TV by first-air window, splits dense date ranges when TMDB pagination would otherwise hide results, fetches production details and credits, retains every credited cast entry with a named character, caches person lookups locally in .cache/, retries transient errors and 429 responses, and writes one compact JSON file per year.

The default hollywood scope uses US movie release data and US-origin TV. worldwide removes that restriction.

## Role gender and playing age

The game requires role gender as a hard casting constraint. TMDB cast credits expose the performer's gender, not a definitive gender field for the fictional character. Imported roles therefore start with the canonical performer's gender and store genderSource as canonical_performer. This is source-labelled so exceptional voice/cross-gender roles can be overridden later without weakening the game's gender rule.

Playing-age bounds are game approximations derived from the historical performer's age unless a better curated value is supplied. Release/first-air year is not the same thing as a verified casting date; the default game casting year remains one year before release.

## Attribution and data hygiene

The app Settings/Credits screen displays TMDB's approved logo and the notice: “This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.”

Review TMDB's current API terms when publishing or redistributing generated catalogue files. Keep credentials out of the repository and browser bundle, and keep the scheduled refresh enabled.
