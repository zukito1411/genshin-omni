import type { CharacterGuide } from '../types/genshin';

/**
 * Player-facing build recommendations live separately from raw game data.
 * Keep every recommendation traceable to a maintained theorycrafting source.
 */
export const guides: Record<string, CharacterGuide> = {
  albedo: {
    characterId: 'albedo',
    role: ['Off-field DPS', 'Geo support'],
    summary: 'A low-field-time off-field Geo DPS who deals most of his damage through Solar Isotoma and can fit into many teams.',
    statPriority: ['CRIT Rate / CRIT DMG', 'DEF%', 'ER when Burst is needed'],
    talentPriority: ['Elemental Skill', 'Elemental Burst', 'Normal Attack'],
    weapons: [
      { name: 'Uraku Misugiri', tier: '5★', note: 'Excellent personal-damage option with CRIT DMG, Skill DMG and DEF support.', source: 'https://keqingmains.com/q/albedo-quickguide/' },
      { name: 'Peak Patrol Song', tier: '5★', note: 'Excellent when you want Albedo to contribute teamwide Elemental DMG Bonus as well as personal damage.', source: 'https://keqingmains.com/q/albedo-quickguide/' },
      { name: 'Cinnabar Spindle', tier: 'Signature', note: 'Albedo’s strongest 4-star option and an especially valuable choice if you already own it.', source: 'https://keqingmains.com/q/albedo-quickguide/' },
      { name: 'Harbinger of Dawn', tier: 'F2P', note: 'A practical low-cost option when you can maintain its CRIT Rate condition.', source: 'https://keqingmains.com/albedo/' },
      { name: 'Flute of Ezpitzal', tier: '4★', note: 'A useful accessible DEF-oriented option if Cinnabar Spindle is unavailable.', source: 'https://keqingmains.com/q/albedo-quickguide/' },
    ],
    artifacts: [
      { set: 'Husk of Opulent Dreams', pieces: '4-piece', note: 'A strong default set for Albedo’s DEF-scaling Skill damage.', source: 'https://keqingmains.com/q/albedo-quickguide/' },
      { set: 'Golden Troupe', pieces: '4-piece', note: 'Competitive for Skill-focused Albedo and can be a convenient farm depending on your account.', source: 'https://keqingmains.com/q/albedo-quickguide/' },
      { set: 'Mixed DEF / Skill DMG sets', pieces: '2-piece + 2-piece', note: 'A practical temporary build while farming a complete set.', source: 'https://keqingmains.com/albedo/' },
    ],
    mainStats: { sands: 'DEF%', goblet: 'Geo DMG% or DEF%', circlet: 'CRIT Rate or CRIT DMG' },
    teams: [
      { name: 'Albedo · Itto · Gorou · Geo/Flex', members: ['Albedo', 'Arataki Itto', 'Gorou', 'Geo / Flex'], note: 'Albedo provides off-field Geo damage and particles while the Geo core benefits from Geo Resonance and Gorou’s DEF-oriented buffs.', },
      { name: 'Albedo · Noelle · Gorou · Flex', members: ['Albedo', 'Noelle', 'Gorou', 'Flex'], note: 'Albedo supplies off-field damage and Geo particles while Noelle remains on field.', },
      { name: 'Albedo · Klee · Furina · Xilonen', members: ['Albedo', 'Klee', 'Furina', 'Xilonen'], note: 'A modern flexible team where Albedo contributes off-field Geo damage and team utility while the other units cover damage and buffs.', source: 'https://keqingmains.com/q/albedo-quickguide/' },
      { name: 'Albedo · Childe · Durin · Xilonen', members: ['Albedo', 'Tartaglia', 'Durin', 'Xilonen'], note: 'A current Hexerei-oriented team example that uses Albedo as an off-field Geo damage and utility slot.', source: 'https://keqingmains.com/q/albedo-quickguide/' },
    ],
    caveats: [
      'Albedo’s Burst is optional in many teams because his Elemental Skill supplies most of his personal damage.',
      'If Burst is used every rotation, Energy Recharge requirements depend heavily on the team.',
      'The best artifact set can depend on which domains you are already farming for the rest of your account.',
    ],
    sourceLinks: [
      { label: 'KQM Quick Guide', url: 'https://keqingmains.com/q/albedo-quickguide/' },
      { label: 'KQM Full Guide', url: 'https://keqingmains.com/albedo/' },
    ],
  },

  nahida: {
    characterId: 'nahida',
    role: ['Off-field DPS', 'Dendro enabler'],
    summary: 'Flexible Dendro support who enables Quicken and Bloom-family teams while dealing strong off-field Dendro damage.',
    statPriority: ['EM', 'CRIT', 'Dendro DMG', 'ER as needed'],
    talentPriority: ['Skill', 'Burst', 'Normal Attack'],
    weapons: [
      { name: 'A Thousand Floating Dreams', tier: 'Signature', note: 'Strong all-purpose option for reaction-focused and support builds.' },
      { name: 'Sacrificial Jade', tier: '4★', note: 'Useful when you want a mixture of CRIT and Elemental Mastery.' },
      { name: 'Magic Guide', tier: 'F2P', note: 'Accessible Elemental Mastery option for reaction teams.' },
    ],
    artifacts: [
      { set: 'Deepwood Memories', pieces: '4-piece', note: 'Default when nobody else on the team supplies Dendro RES reduction.' },
      { set: 'Gilded Dreams', pieces: '4-piece', note: 'Strong personal reaction damage when Deepwood is already covered.' },
    ],
    mainStats: { sands: 'EM%', goblet: 'Dendro DMG or EM%', circlet: 'CRIT or EM%' },
    teams: [
      { name: 'Quicken', members: ['Nahida', 'Electro DPS', 'Electro / Dendro Flex', 'Healer / Buffer'], note: 'Maintain Dendro uptime and let the Electro core trigger reactions.' },
      { name: 'Hyperbloom', members: ['Nahida', 'Hydro', 'Electro Trigger', 'Flex'], note: 'Build the Electro trigger around Elemental Mastery.' },
    ],
  },

  'hu-tao': {
    characterId: 'hu-tao',
    role: ['On-field DPS', 'Vaporize'],
    summary: 'Pyro polearm carry that converts HP management into strong Charged Attack and reaction damage.',
    statPriority: ['CRIT', 'HP%', 'EM', 'ATK%'],
    talentPriority: ['Normal Attack', 'Skill', 'Burst'],
    weapons: [
      { name: 'Staff of Homa', tier: 'Signature', note: 'Strong option that naturally complements Hu Tao’s HP mechanics.' },
      { name: "Dragon's Bane", tier: '4★', note: 'Strong reaction-focused option in Vaporize teams.' },
      { name: 'White Tassel', tier: 'F2P', note: 'Accessible early-game option when stronger polearms are unavailable.' },
    ],
    artifacts: [
      { set: 'Crimson Witch of Flames', pieces: '4-piece', note: 'Classic reaction-oriented option.' },
      { set: "Shimenawa's Reminiscence", pieces: '4-piece', note: 'Strong Charged Attack focus with less Burst comfort.' },
    ],
    mainStats: { sands: 'HP% or EM', goblet: 'Pyro DMG%', circlet: 'CRIT' },
    teams: [
      { name: 'Vaporize', members: ['Hu Tao', 'Hydro Enabler', 'Anemo / Flex', 'Shield / Support'], note: 'Keep Hydro application available and protect Hu Tao during her field time.' },
    ],
  },
};

export function getGuide(idOrName: string): CharacterGuide | undefined {
  const key = idOrName.toLowerCase().trim();
  return guides[key] ?? guides[key.replace(/\s+/g, '-')];
}
