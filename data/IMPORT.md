# Historical catalogue import

The included sample is intentionally small. To expand it, acquire a TMDB developer API token for a non-commercial project. TMDB's daily ID export lists valid IDs; it is **not** a full data export. Fetch project details and credits with the API and review the output before publishing. The script imports a bounded year range and writes one JSON file per year, which can be manually merged or served as demand-loaded shards in the next iteration.

```bash
export TMDB_TOKEN='your token here'
python3 scripts/import_tmdb.py --start 1995 --end 1995 --max-pages 3
```

The script queries discover/movie and discover/tv, then details with `append_to_response=credits`, with cautious delay and retries. Film `year` is the TMDB release year; TV `year` is first-air year. Series need additional season-level work for accurate annual casting. TMDB data can have omissions, different release regions, or cast-credit inconsistencies. Release year is not casting year. Avoid invented precise shooting dates.

The public game must include TMDB's approved logo and the attribution notice in Credits before using imported TMDB data. Review TMDB's current terms before publishing bulk derivative datasets. Keep credentials in environment variables locally and out of public repos.
