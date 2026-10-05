/** Exact game filenames supplied by the data providers, with independent mirrors. */
export function gameImageSources(filename?: string): string[] {
  if (!filename) return [];
  const icon = filename.replace(/\.(png|webp)$/i, '');
  if (!/^(?:UI_|Skill_)[\w-]+$/.test(icon)) return [];
  return [
    `https://enka.network/ui/${icon}.png`,
    // This mirror covers older assets; newer assets continue through the CDNs.
    `https://raw.githubusercontent.com/PathOfGenshin/resources/main/resources/gi/Sprite/${icon}.png`,
    `https://gi.yatta.moe/assets/UI/${icon}.png`,
    `https://static.nanoka.cc/gi/UI/${icon}.webp`,
  ];
}
