import type { FAQItem } from '../types/genshin';

export const faqs: FAQItem[] = [
  { question: 'Where does the app get character data?', answer: 'Character, weapon, artifact, and material information comes from community-maintained references such as GenshinDB. Build pages include links to their guides, and the Sources page credits the references and artwork.', tags: ['characters', 'references'] },
  { question: 'How should I choose a character build?', answer: 'Start with the recommended weapons, artifact sets, and stat priorities, then adapt them to your teammates and equipment. Follow the guide links for detailed explanations and alternatives.', tags: ['builds', 'teams'] },
  { question: 'Are build recommendations objective?', answer: 'No. The app labels manually curated advice separately from live game data and provides multiple external references. Patch-sensitive recommendations should always be cross-checked against current theorycrafting.', tags: ['builds', 'meta'] },
  { question: 'Does the app store my UID?', answer: 'No sign-in or game password is required. Your most recently searched UID is remembered in this browser for convenience. Searching shares that UID with the public profile service, and recently viewed profiles may be saved on this device.', tags: ['profiles', 'privacy'] },
  { question: 'Where are my teams and favorites saved?', answer: 'Teams, favorites, and material checklists stay in this browser on this device. They do not automatically sync between devices. Clearing this site\'s saved data removes them.', tags: ['saved plans', 'privacy'] },
  { question: 'Why does a material quantity sometimes show “—”?', answer: 'A dash means the amount is unavailable. The farming plan leaves missing quantities blank rather than guessing what you need.', tags: ['materials', 'accuracy'] },
  { question: 'Why are some of my characters missing from UID Search?', answer: 'UID Search shows only the characters in your public showcase, not your entire account. Add the characters to your in-game showcase and enable “Show Character Details” to share their equipment and stats.', tags: ['profiles', 'showcase'] },
];
