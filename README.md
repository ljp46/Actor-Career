# Second Take

A mobile-first, offline-capable prototype for an alternate-history actor life sim. Start on your fourth birthday, audition for sampled historical roles, change your save's cast, build family and relationships, spend your earnings, and continue into procedurally generated future years. Dating-app introductions appear from 2012 onward for adult characters.

## Play locally

```bash
cd second-take
python3 -m http.server 8080
```

Open `http://localhost:8080`. All gameplay works without a build step. On GitHub Pages, publish the repository root on the `main` branch. On iPhone, open the HTTPS URL in Safari and add it to the Home Screen. A service worker caches the app shell. Save data lives on the device; use Settings → Export save for backups.

## Current scope

`data/sample.json` contains 23 hand-curated, recognizable real-film examples, not the entire historical film/TV database. The catalogue records release year and leading cast; audition windows and age ranges are game rules, not historical claims. The UI does not claim completeness. The long-form TMDB ingestion route is documented in `data/IMPORT.md` and implemented in `scripts/import_tmdb.py`. Year shards listed in `data/years/index.json` load as the game reaches them. Do not commit an API token or embed it in client-side JavaScript.

The save holds per-project cast and director overrides, family, relationships, filmography, and future procedural projects. Real baseline data is never mutated. Future years create three projects yearly and new names are checked against a persistent registry. Browser quota and device performance are finite, so “without limit” means no fixed in-game ending; periodic save compaction, historical data shards, and performance work are needed for centuries-long play.

Relationship events and memorial tributes involving public figures are fictional game outcomes, not statements about their private lives or words they said. This independent fan project is unaffiliated with Hollywood Talent Tycoon and any studio.

## Next milestones

- Expand a licensed historical catalogue in per-year shards, with films and TV seasons, cast and verified biographical fields.
- Add film production schedules, awards, fuller career economics, agents, relationships, dating apps by era, childhood gameplay, and multi-generational aging.
- Add an indexed, versioned save store with migrations and streaming loads for large timelines.

## Tests

Run `node --test tests/*.test.js`.
