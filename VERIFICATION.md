# Teyvat Atlas Verification Notes

## Architecture
- React + TypeScript + Vite only.
- No application backend, Express server, `server.mjs`, or `npm start` requirement.
- Render is configured as a Static Site.

## Data sources
- GenshinDB API: character roster, character data, stats, talents, constellations, weapons, artifacts and other structured game data.
- genshin.dev: character/entity API and image endpoints.
- Enka Network / Hakush / Yatta public UI CDNs: image fallback when an exact UI filename is available.
- Genshin.gg, Genshin Builds, Genshin Build and KQM: current player build references fetched through Jina Reader from the browser.
- AppSample Genshin Interactive Map: official iframe embed with searchable marker names.

## Player-data behavior
- Character build recommendations are not stored as a small hardcoded character list.
- `src/data/guides.ts` is intentionally absent.
- Build data is requested for the selected character and merged from available sources.
- Source slug fallbacks try the full character slug and short-name variants.
- Character images have direct-URL, source-filename, Enka/Hakush/Yatta, and genshin.dev fallbacks.
- Material extraction supports both object-shaped `{name, amount}` entries and map-shaped `{MaterialName: amount}` costs.

## Checks performed in this environment
- 30 TypeScript/TSX source files were transpiled with TypeScript 5.8.3 without transpile diagnostics (declaration file excluded from that syntax check).
- Player-guide parser was tested against a representative Genshin.gg Alyosha page structure and returned role, weapons, artifacts, main stats, substats, talent priority and teams.
- Material extraction was tested against both ascension and talent cost maps and produced numeric totals without double-counting the same object traversal.
- No hardcoded Albedo/Nahida/Hu Tao guide file remains.

## Local verification
Run with the project's real dependencies:

```bash
npm install
npm run build
npm run dev
```

Then verify `/characters`, several character detail pages, `/weapons`, `/artifacts`, `/materials`, `/teams`, and `/map`.
