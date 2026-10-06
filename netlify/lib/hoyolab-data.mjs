// Only explicitly selected display fields leave the private backend.
const text = (value, limit = 120) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, limit) : '';
const number = (value, maximum = 1e9) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum ? value : null;
const list = (value, maximum = 200) => Array.isArray(value) ? value.slice(0, maximum) : [];
const name = (value, fallback) => { const clean = text(value); return clean && !/^\d+$|^(?:item|character|weapon|artifact)[\s#-]*\d+$/i.test(clean) ? clean : fallback; };
export function imageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash || !['hoyolab.com', 'hoyoverse.com', 'mihoyo.com'].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return '';
    // HoYo's upload CDN adds image-processing parameters to otherwise public
    // artwork. Drop only that known transform, never accept signed/private URLs.
    if ([...url.searchParams.keys()].some((key) => key !== 'x-oss-process')) return '';
    url.search = '';
    return url.href;
  } catch { return ''; }
}
export function normalizeRoles(data) {
  return list(data?.list, 20).filter((role) => role?.game_biz === 'hk4e_global' && /^\d{9,10}$/.test(String(role.game_uid)) && ['os_usa', 'os_euro', 'os_asia', 'os_cht'].includes(role.region))
    .map((role) => ({ uid: String(role.game_uid), region: role.region, server: text(role.region_name) || role.region, nickname: text(role.nickname) || 'Traveler', level: number(role.level, 100) }));
}
export function normalizeCharacter(value) {
  return { id: number(value?.id ?? value?.avatar_id), name: name(value?.name, 'Name unavailable'), icon: imageUrl(value?.icon), element: text(value?.element, 20), rarity: value?.rarity === 105 ? 5 : number(value?.rarity, 5), level: number(value?.level, 100), friendship: number(value?.fetter, 10), constellation: number(value?.actived_constellation_num, 6) };
}
export function normalizeProfile(role, index, notes, characters, updatedAt, unavailable) {
  const stats = index?.stats;
  const n = notes;
  const resin = number(n?.current_resin, 1000), maximum = number(n?.max_resin, 1000);
  const recovery = n?.resin_recovery_time !== undefined && /^\d{1,8}$/.test(String(n.resin_recovery_time)) ? Number(n.resin_recovery_time) : null;
  return {
    role, updatedAt, unavailable,
    stats: {
      achievements: number(stats?.achievement_number), daysActive: number(stats?.active_day_number), characters: number(stats?.avatar_number), abyss: text(stats?.spiral_abyss, 30) || null,
      theaterAct: stats?.role_combat?.has_data === true ? number(stats.role_combat.max_round_id, 20) : null,
      stygian: stats?.hard_challenge?.has_data === true ? text(stats.hard_challenge.name) || null : null,
      waypoints: number(stats?.way_point_number), domains: number(stats?.domain_number),
      chests: [['Common chests', 'common_chest_number'], ['Exquisite chests', 'exquisite_chest_number'], ['Precious chests', 'precious_chest_number'], ['Luxurious chests', 'luxurious_chest_number'], ['Remarkable chests', 'magic_chest_number']].map(([label, key]) => ({ label, value: number(stats?.[key]) })),
    },
    notes: n ? {
      resin: resin !== null && maximum > 0 && resin <= maximum ? resin : null, maxResin: maximum, recoverySeconds: recovery === 0 && resin !== maximum ? null : recovery,
      commissions: number(n.finished_task_num, 20), maxCommissions: number(n.total_task_num, 20), commissionRewardClaimed: typeof n.is_extra_task_reward_received === 'boolean' ? n.is_extra_task_reward_received : null,
      realmCurrency: number(n.current_home_coin), maxRealmCurrency: number(n.max_home_coin),
      expeditions: list(n.expeditions, 8).map((entry) => ({ icon: imageUrl(entry?.avatar_side_icon), status: entry?.status === 'Finished' ? 'Finished' : 'Ongoing', remainingSeconds: /^\d{1,8}$/.test(String(entry?.remained_time)) ? Number(entry.remained_time) : null })),
    } : null,
    exploration: list(index?.world_explorations, 40).map((area) => {
      const icons = [...new Set([area?.icon, area?.inner_icon, area?.cover, area?.background_image].map(imageUrl).filter(Boolean))];
      return { name: text(area?.name) || 'Area name unavailable', icon: icons[0] ?? '', icons, percentage: number(area?.exploration_percentage, 10000) === null ? null : area.exploration_percentage / 10, level: number(area?.level, 100) };
    }),
    characters: list(characters?.list).filter((entry) => number(entry?.id ?? entry?.avatar_id) !== null).map(normalizeCharacter),
  };
}
export function normalizeBuild(data, characterId) {
  const detail = list(data?.list, 10).find((entry) => String(entry?.base?.id ?? entry?.base?.avatar_id ?? entry?.id ?? entry?.avatar_id) === String(characterId));
  if (!detail) return null;
  // Actual character/detail responses put identity and progression in `base`.
  // Keep the detailed weapon at the top level, not the incomplete base.weapon.
  const character = { ...detail, ...(detail.base ?? {}), weapon: detail.weapon, image: detail.image };
  const map = data?.property_map ?? {};
  const property = (entry) => {
    const info = map[String(entry?.property_type)] ?? entry?.info;
    const label = text(info?.name);
    const raw = entry?.final ?? entry?.value;
    const value = text(typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : raw, 80);
    return label && value ? { label, value } : null;
  };
  const properties = (entries) => list(entries, 40).map(property).filter(Boolean);
  const weapon = character.weapon;
  return {
    ...normalizeCharacter(character), image: imageUrl(character.image),
    stats: properties([...list(character.base_properties), ...list(character.extra_properties), ...list(character.element_properties), ...list(character.selected_properties)]).filter((entry, index, entries) => entries.findIndex((other) => other.label === entry.label) === index),
    weapon: weapon ? { name: name(weapon.name, 'Weapon name unavailable'), icon: imageUrl(weapon.icon), level: number(weapon.level, 100), refinement: number(weapon.affix_level, 5), rarity: number(weapon.rarity, 5), stats: properties([weapon.main_property, weapon.sub_property]) } : null,
    artifacts: list(character.relics, 5).map((item) => ({ name: name(item?.name, 'Artifact name unavailable'), icon: imageUrl(item?.icon), slot: text(item?.pos_name), level: number(item?.level, 20), set: name(item?.set?.name, ''), stats: properties([item?.main_property, ...list(item?.sub_property_list, 4)]) })),
    skills: list(character.skills, 12).map((skill) => ({ name: text(skill?.name) || 'Talent name unavailable', icon: imageUrl(skill?.icon), level: number(skill?.level, 20), description: text(skill?.desc, 2000) })),
    constellations: list(character.constellations, 6).map((entry) => ({ name: text(entry?.name) || 'Constellation name unavailable', icon: imageUrl(entry?.icon), unlocked: entry?.is_actived === true, description: text(entry?.effect, 2000) })),
  };
}
