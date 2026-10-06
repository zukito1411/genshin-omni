import { gameImageSources } from '../api/assets';

/** Use the supplied HoYo image first, then exact-filename game mirrors. */
export function profileImageSources(source: string | string[] | undefined): string[] {
  const urls = typeof source === 'string' ? [source] : source ?? [];
  return [...new Set(urls.flatMap((url) => url ? [url, ...gameImageSources(url)] : []))];
}
