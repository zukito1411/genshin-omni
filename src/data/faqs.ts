import type { FAQItem } from '../types/genshin';

export const faqs: FAQItem[] = [
  { question: 'Where does the app get character data?', answer: 'Character and related structured game data are requested from GenshinDB. Character images are resolved separately through genshin.dev. The character page shows which providers contributed to the page.', tags: ['data', 'characters'] },
  { question: 'Why does the app not scrape every guide site?', answer: 'A static client app cannot reliably bypass CORS, anti-bot rules, robots policies or changing HTML. Instead, structured public APIs are combined in the data layer and guide sites are linked as references.', tags: ['architecture', 'sources'] },
  { question: 'Are build recommendations objective?', answer: 'No. The app labels manually curated advice separately from live game data and provides multiple external references. Patch-sensitive recommendations should always be cross-checked against current theorycrafting.', tags: ['builds', 'meta'] },
  { question: 'Does the app store my UID?', answer: 'No server-side account is created. UID lookups are sent directly to the configured Enka endpoint and the response may be cached briefly in browser storage for the same device.', tags: ['enka', 'privacy'] },
  { question: 'Where are my teams and favorites saved?', answer: 'Teams, favorites, material checklists and tracker state are stored in browser localStorage. Clearing site data removes them.', tags: ['local storage', 'account'] },
  { question: 'Why does a material quantity sometimes show “—”?', answer: 'The app refuses to invent quantities when the upstream character payload does not expose a numeric amount in the schema. When the source does not provide a reliable quantity, the planner leaves it blank instead of guessing.', tags: ['materials', 'accuracy'] },
  { question: 'Can I deploy this without a backend?', answer: 'Yes. The app is a Vite React SPA. Netlify or Render can host the static build while the browser requests the public APIs directly. Live data still depends on the provider being reachable and allowing browser requests; successful responses are cached locally.', tags: ['deploy', 'netlify', 'render'] },
];
