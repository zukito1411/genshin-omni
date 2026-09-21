# Teyvat Atlas

Teyvat Atlas is a player-first Genshin Impact companion. Character pages combine live game data with current player build data so players can see character information, recommended weapons, artifacts, stats, teams, talents, constellations and materials in one place.

## Data model

- **GenshinDB API** supplies structured game data and the live character index.
- **genshin.dev** supplies additional entity data and image assets.
- **Genshin.gg** is read server-side for current character builds, recommended weapons, artifact sets, main stats, substats, team archetypes and upgrade-material references.
- **Prydwen** is a server-side fallback for character build/reference data when a Genshin.gg page is unavailable.
- **KeqingMains** remains a player-facing theorycrafting reference source and is linked from character pages.
- **Enka.Network** remains available for public UID/showcase lookups.

The source pages are cached on the Teyvat Atlas server. The cache expires automatically, so the app does not require a hand-maintained build entry for every character.

## Development

```bash
npm install
npm run dev
```

The Vite development server is used for frontend work. The live server-side source aggregator is enabled in the deployed Render service.

## Production / Render

This project is deployed as a **Node web service**, not a Render Static Site, because the player build data is fetched server-side to avoid browser CORS restrictions and to keep scraping/source logic out of the player UI.

```text
Build command: npm install && npm run build
Start command: npm start
```

The Node server serves `dist/` and exposes:

```text
GET /api/health
GET /api/player/guide?slug=albedo
```

The React application falls back to the existing structured game-data sources if the player guide endpoint is temporarily unavailable.

## Player experience

A character page is intended to answer the practical questions a player has:

- What does this character do?
- What role do they fill?
- Which weapons should I consider?
- Which artifact sets should I use?
- What main stats and substats should I target?
- Which teams use this character?
- Which talents matter most?
- What are the character's skills and constellations?
- What materials are needed for leveling?
- Where did the displayed recommendation come from?

Raw provider payloads and developer-oriented API diagnostics are not part of the normal player experience.
