import type { PaimonPage, PaimonReply } from './types';
type PaimonHelpReply = PaimonReply;
const randomItem = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export function getPaimonHelpReply(question: string, page: PaimonPage, name?: string): PaimonHelpReply {
  const query = question.trim().toLowerCase();
  const now = new Date();
  if (/\bhow are you\b|\bare you okay\b/.test(query)) {
    return { text: randomItem(['Paimon is doing great! Thanks for asking, Traveler!', 'Paimon is feeling sparkly and ready to help!', 'Paimon is good! A little hungry, but good!']) };
  }
  if (/\b(?:what(?:'s| is) (?:the )?time|time is it|current time)\b/.test(query)) {
    return { text: `It’s ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now)} on your device.` };
  }
  if (/\b(?:today's date|what(?:'s| is) (?:the )?date|what day is it)\b/.test(query)) {
    return { text: `Today is ${new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now)}.` };
  }
  if (/^(hi|hello|hey|yo)\b/.test(query)) {
    return { text: randomItem(['Hi, Traveler! What are we working on?', 'Hello! Paimon is ready!', 'Hey! Need a hand with your adventure?']) };
  }
  if (/\bwho are you\b|\bwhat are you\b/.test(query)) {
    return { text: 'Paimon is your Teyvat Atlas helper! Paimon can point you to builds, materials, teams, comparisons, your roster, and the map.' };
  }
  if (/\bthank(s| you)\b/.test(query)) {
    return { text: 'You’re welcome! Paimon is happy to help!' };
  }
  if (/\b(joke|funny)\b/.test(query)) {
    return { text: 'Why did the Hilichurl bring a ladder? It heard the Adventure Rank was going up!' };
  }
  if (/\b(bye|goodbye|see you)\b/.test(query)) {
    return { text: 'See you later, Traveler! Don’t forget your resin!' };
  }
  if (/\b(?:farm(?:ing)?|materials?|resin|domains?|boss(?:es)?)\b/.test(query)) {
    return { text: 'Let’s make a farming checklist from the characters you want to raise.', route: '/materials', actionLabel: 'Open Farming Plan' };
  }
  if (/\b(?:teams?|reactions?|resonance|rotations?|party)\b/.test(query)) {
    return { text: 'Pick four characters, assign their roles, then check the reaction and resonance hints.', route: '/teams', actionLabel: 'Open Team Builder' };
  }
  if (/\b(?:compare|comparison|versus|vs|better)\b/.test(query)) {
    return { text: 'The comparison tool puts progression and sourced build guidance side by side.', route: '/compare', actionLabel: 'Compare Characters' };
  }
  if (/\b(?:my profile|hoyolab|my resin|my commissions)\b/.test(query)) return { text: 'My Profile shows your connected HoYoLAB account and available daily notes. Only connect your own account, and never put session tokens or passwords in chat.', route: '/me', actionLabel: 'Open My Profile' };
  if (/\b(?:uid|showcase|profiles?)\b/.test(query)) {
    return { text: 'Search a UID, then choose a public showcase character to see their equipped stats, weapons, and artifacts.', route: '/profile', actionLabel: 'Open UID Search' };
  }
  if (/\b(?:roster|own|owned|account)\b/.test(query)) {
    return { text: 'You can mark your roster locally, or look up the public characters a UID has chosen to showcase.', route: '/account', actionLabel: 'Open My Roster' };
  }
  if (/\b(?:weapons?|artifacts?|builds?|talents?|constellations?)\b/.test(query)) {
    if (page === 'character' && name) return { text: `You’re already viewing ${name}. Try Build & Teams, then Skills or Materials for the next decision.` };
    return { text: 'Open a character to see their current build sources, talents, materials, weapons, and artifact options.', route: '/characters', actionLabel: 'Browse Characters' };
  }
  if (/\b(?:map|explore|exploration|chests?|waypoints?)\b/.test(query)) {
    return { text: 'The official interactive map has the most complete current exploration filters.', route: '/map', actionLabel: 'Open Map' };
  }
  if (page === 'materials') return { text: 'Choose characters first, then Build checklist. Paimon only shows a farming day when the source actually provides one.' };
  if (page === 'teams') return { text: 'Give each teammate the role you intend them to perform. The advisor then checks coverage and possible reactions without guessing your builds.' };
  if (page === 'compare') return { text: 'Choose a character on each side. Paimon will line up progression and current sourced build guidance.' };
  if (page === 'account') return { text: 'Your local roster stays in this browser. A UID can only show the account’s public Enka showcase.' };
  if (page === 'profile') return { text: 'Search a UID, then select a showcase character to inspect their build. The player needs to enable public character details in-game.' };
  return { text: 'Ask Paimon about materials, teams, comparisons, your roster, builds, or exploration!' };
}

