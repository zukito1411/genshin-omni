import { expect, test } from '@playwright/test';
import { combinedKitLists, fillKitArtwork, needsKitArtwork } from '../src/utils/characterKit';
import { extractConstellations, extractTalents } from '../src/utils/genshin';
import { gameText } from '../src/utils/gameText';
import { normalizeCharacter, normalizeEntity } from '../src/utils/normalize';
import { mapConcurrent } from '../src/utils/concurrency';

test('kit records keep root artwork, sparse constellation levels and complementary fields', () => {
  const primary = {
    name: 'Character kit', description: 'Not a skill.',
    combat1: { name: 'Normal Attack', description: '<color=#fff>Hit</color>\\nAgain.' },
    passive1: { name: 'Passive', description: 'A passive effect.' },
    images: { filename_combat1: 'Skill_A_01', filename_passive1: 'UI_Talent_Passive', filename_icon: 'UI_AvatarIcon_Test' },
  };
  const secondary = { skillTalents: [{ name: 'Normal Attack', description: 'Alternate wording.', type: 'Normal Attack' }] };
  const talents = extractTalents({ talents: combinedKitLists(['talents', 'skillTalents', 'passiveTalents'], primary, secondary) });
  expect(talents).toHaveLength(2);
  expect(talents[0]).toMatchObject({ name: 'Normal Attack', description: 'Hit\nAgain.', icon: 'Skill_A_01' });
  expect(talents[1].icon).toBe('UI_Talent_Passive');
  const constellations = extractConstellations({ constellations: combinedKitLists(['constellations'], {
    result: { c1: { name: 'First', description: 'First effect.' }, c6: { name: 'Sixth', description: 'Sixth effect.' } },
    images: { filename_c1: 'UI_Talent_Test_01', filename_c6: 'UI_Talent_Test_06' },
  }, [{ name: 'Sixth', description: 'Duplicate without artwork.' }]) });
  expect(constellations).toHaveLength(2);
  expect(constellations[1]).toMatchObject({ name: 'Sixth', level: 6, icon: 'UI_Talent_Test_06' });
  expect(extractConstellations({ constellations: [{ name: 'Only sixth', description: 'A sparse list.', level: 6 }] })[0].level).toBe(6);
});

test('kits in nested lists retain image metadata and never include unrelated character descriptions', () => {
  const raw = {
    name: 'Character', description: 'Character biography.', images: { filename_icon: 'UI_AvatarIcon_Test' },
    talents: { result: [{ key: 'combat2', name: 'Skill', description: 'Skill effect.' }], images: { filename_combat2: 'Skill_S_Test' } },
    constellations: [{ name: 'C1', description: 'Constellation effect.', level: 1 }],
  };
  expect(extractTalents(raw).map((entry) => entry.name)).toEqual(['Skill']);
  expect(extractTalents(raw)[0].icon).toBe('Skill_S_Test');
  expect(extractConstellations(raw).map((entry) => entry.name)).toEqual(['C1']);
  expect(extractTalents({ talents: { ...raw, talents: [{ name: 'Nested', description: 'Actual talent.' }] } }).map((entry) => entry.name)).toEqual(['Nested']);
});

test('game text cleans tags, entities, escapes and blank metadata without rendering HTML', () => {
  expect(gameText('<color=#fff>CRIT DMG</color>: 20%\\nA &amp; B<br>Traveler&#39;s effect.')).toBe("CRIT DMG: 20%\nA & B\nTraveler's effect.");
  expect(gameText('Deal 5 < 10 damage.')).toBe('Deal 5 < 10 damage.');
  expect(gameText('&#99999999; &lt;b&gt;Safe&lt;/b&gt;')).toBe('Safe');
  expect(normalizeCharacter({ name: 'Test', description: '<color=#fff>Bio</color>', weaponText: ' ', weapontype: 'Sword' })).toMatchObject({ description: 'Bio', weapon: 'Sword' });
  expect(normalizeEntity({ name: 'Set', effect2Pc: '<color=#fff>ATK</color> +18%', description: 'A &amp; B' })).toMatchObject({ twoPieceBonus: 'ATK +18%', description: 'A & B' });
  expect(normalizeCharacter({ name: 'Test', element: 'ELEMENT_CRYO', weapon: 'WEAPON_SWORD_ONE_HAND' })).toMatchObject({ element: 'Cryo', weapon: 'Sword' });
});

test('missing kit artwork uses exact combat slots and never invents passive icons', () => {
  const talents = [{ name: 'Skill', type: 'ELEMENTAL_SKILL' }, { name: 'Passive', key: 'passive1' }];
  const constellations = [{ name: 'Sixth', level: 6 }];
  expect(needsKitArtwork(talents, constellations)).toBe(true);
  const enriched = fillKitArtwork(talents, constellations, { SkillOrder: [1, 2, 3], Skills: { '2': 'Skill_S_Test' }, Consts: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] });
  expect(enriched.talents[0].icon).toBe('Skill_S_Test');
  expect(enriched.talents[1].icon).toBeUndefined();
  expect(enriched.constellations[0].icon).toBe('C6');
  expect(needsKitArtwork(enriched.talents, enriched.constellations)).toBe(false);
});

test('worker pools preserve ordering, bound concurrency and stop queued work on cancellation', async () => {
  let running = 0;
  let maximum = 0;
  const results = await mapConcurrent([1, 2, 3, 4, 5, 6], 2, async (value) => {
    maximum = Math.max(maximum, ++running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running--;
    return value * 2;
  });
  expect(maximum).toBe(2);
  expect(results).toEqual([2, 4, 6, 8, 10, 12]);
  const controller = new AbortController();
  const visited: number[] = [];
  await expect(mapConcurrent([1, 2, 3], 1, async (value) => { visited.push(value); controller.abort(); return value; }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(visited).toEqual([1]);
});
