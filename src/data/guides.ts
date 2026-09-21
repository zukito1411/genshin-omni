import type { CharacterGuide } from '../types/genshin';

/**
 * Curated recommendations live here instead of inside the API adapter.
 * This makes opinionated build advice auditable and easy to update separately from game data.
 */
export const guides: Record<string, CharacterGuide> = {
  nahida: {
    characterId: 'nahida',
    role: ['Off-field DPS', 'Dendro enabler'],
    summary: 'Flexible Dendro support who enables Quicken, Bloom-family teams and off-field Dendro damage.',
    statPriority: ['EM', 'CRIT', 'Dendro DMG', 'ER as needed'],
    talentPriority: ['Skill', 'Burst', 'Normal Attack'],
    weapons: [
      { name: 'A Thousand Floating Dreams', tier: 'Signature', note: 'Strongest all-purpose support/DPS option.' },
      { name: 'Sacrificial Jade', tier: '4★', note: 'Useful when you want mixed CRIT and EM value.' },
      { name: 'Magic Guide', tier: 'F2P', note: 'Low-cost EM option for reaction-focused builds.' },
    ],
    artifacts: [
      { set: 'Deepwood Memories', pieces: '4-piece', note: 'Default when nobody else supplies Dendro RES Shred.' },
      { set: 'Gilded Dreams', pieces: '4-piece', note: 'Strong personal reaction damage when Deepwood is covered.' },
    ],
    mainStats: { sands: 'EM%', goblet: 'Dendro DMG or EM%', circlet: 'CRIT or EM%' },
    teams: [
      { name: 'Quick / Quicken', members: ['Nahida', 'Electro DPS', 'Electro / Dendro Flex', 'Healer / Buffer'], note: 'Keep Dendro uptime high and let the Electro core trigger reactions.' },
      { name: 'Hyperbloom', members: ['Nahida', 'Hydro', 'Electro trigger', 'Flex'], note: 'Prioritize the Electro trigger build around EM.' },
    ],
    sourceLinks: [
      { label: 'KeqingMains search', url: 'https://keqingmains.com/?s=Nahida' },
    ],
  },
  'hu-tao': {
    characterId: 'hu-tao',
    role: ['On-field DPS', 'Vaporize'],
    summary: 'Pyro polearm carry that converts HP management into strong charged-attack and reaction damage.',
    statPriority: ['CRIT', 'HP%', 'EM', 'ATK%'],
    talentPriority: ['Normal Attack', 'Skill', 'Burst'],
    weapons: [
      { name: 'Staff of Homa', tier: 'Signature', note: 'Strong universal option that fits her HP mechanic.' },
      { name: 'Dragon\'s Bane', tier: '4★', note: 'Very strong reaction option in Vaporize teams.' },
      { name: 'White Tassel', tier: 'F2P', note: 'Budget option when premium polearms are unavailable.' },
    ],
    artifacts: [
      { set: 'Crimson Witch of Flames', pieces: '4-piece', note: 'Classic reaction-oriented set.' },
      { set: 'Shimenawa\'s Reminiscence', pieces: '4-piece', note: 'High charged-attack focus at the cost of Burst comfort.' },
    ],
    mainStats: { sands: 'HP% or EM', goblet: 'Pyro DMG%', circlet: 'CRIT' },
    teams: [
      { name: 'Vaporize', members: ['Hu Tao', 'Hydro enabler', 'Anemo / VV flex', 'Shield / Support'], note: 'Keep enemies wet and protect her during charged-attack windows.' },
    ],
  },
};

export function getGuide(idOrName: string): CharacterGuide | undefined {
  const key = idOrName.toLowerCase().trim();
  return guides[key];
}
