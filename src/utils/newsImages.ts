export interface NewsImageCandidate { src: string; srcSet?: string; }
interface NewsArtwork { image?: string; content_html?: string; url?: string; }
const UPLOAD_HOST = 'upload-os-bbs.hoyolab.com';
const WIDTHS = [320, 480, 640, 960, 1280, 1600, 2048];
const artworkCache = new WeakMap<NewsArtwork, { image?: string; html?: string; url?: string; candidates: NewsImageCandidate[] }>();

export function newsImageUrl(value: string | null | undefined, base?: string): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) return null;
  try {
    const url = new URL(value.trim().startsWith('//') ? `https:${value.trim()}` : value.trim(), base);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
function publicUpload(value: string): URL | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  if (url.hostname !== UPLOAD_HOST || !/^\/upload\/.+\.(?:jpe?g|png|webp)$/i.test(url.pathname) || [...url.searchParams.keys()].some((key) => key !== 'x-oss-process')) return null;
  const process = url.searchParams.get('x-oss-process');
  // Preserve signed URLs and intentional crops/rotations/overlays. Only common
  // public thumbnail transformations observed in the feed may be replaced.
  if (process && !/^image(?:\/(?:resize,(?:(?:[whls]|limit)_\d+|m_lfit)(?:,(?:(?:[whls]|limit)_\d+|m_lfit))*|auto-orient,[01]|interlace,[01]|format,(?:jpg|jpeg|png|webp)|quality,[qQ]_\d+))*$/.test(process)) return null;
  url.search = '';
  return url;
}
function identity(src: string): string { return publicUpload(src)?.href ?? src; }
export function responsiveNewsImage(src: string): NewsImageCandidate | null {
  const upload = publicUpload(src);
  if (!upload) return null;
  const variant = (width: number) => {
    const url = new URL(upload);
    // Same centered 16:7 crop as the existing banner. Fixed output dimensions
    // make width descriptors truthful; upscale cannot invent source detail.
    url.searchParams.set('x-oss-process', `image/auto-orient,1/resize,m_fill,w_${width},h_${width * 7 / 16},limit_0/format,webp/quality,q_90`);
    return url.href;
  };
  return { src: variant(640), srcSet: WIDTHS.map((width) => `${variant(width)} ${width}w`).join(', ') };
}
function providedSrcSet(value: string | null, base?: string): string | undefined {
  if (!value || value.length > 12_000) return;
  const matches = [...value.matchAll(/(?:^|,\s*)(\S+)\s+(\d+(?:\.\d+)?)(w|x)(?=\s*(?:,|$))/g)];
  const type = matches[0]?.[3];
  const variants = new Map<number, string>();
  for (const match of matches.slice(0, 12)) {
    const src = newsImageUrl(match[1], base);
    const size = Number(match[2]);
    if (!src || match[3] !== type || size <= 0 || size > (type === 'w' ? 8192 : 4) || (type === 'w' && !Number.isInteger(size))) continue;
    variants.set(size, `${src} ${size}${type}`);
  }
  return variants.size ? [...variants].sort(([a], [b]) => a - b).map(([, variant]) => variant).join(', ') : undefined;
}
function options(src: string, srcSet?: string): NewsImageCandidate[] {
  const responsive = srcSet ? { src, srcSet } : responsiveNewsImage(src);
  const original = publicUpload(src)?.href ?? src;
  return [...(responsive ? [responsive] : []), { src: original }, ...(original !== src ? [{ src }] : [])];
}
export function newsImageCandidates(item: NewsArtwork): NewsImageCandidate[] {
  const cached = artworkCache.get(item);
  if (cached && cached.image === item.image && cached.html === item.content_html && cached.url === item.url) return cached.candidates;
  const cover = newsImageUrl(item.image, item.url);
  const groups: Array<{ sources: string[]; candidates: NewsImageCandidate[] }> = [];
  if (typeof item.content_html === 'string') {
    try {
      const document = new DOMParser().parseFromString(item.content_html.slice(0, 200_000), 'text/html');
      for (const image of Array.from(document.querySelectorAll('img')).slice(0, 24)) {
        const width = image.getAttribute('width'); const height = image.getAttribute('height');
        if (image.getAttribute('no-preview') === 'true' || (width && /^\d+$/.test(width) && Number(width) <= 32) || (height && /^\d+$/.test(height) && Number(height) <= 8)) continue;
        const sources = ['data-original', 'data-original-src', 'data-src', 'data-lazy-src', 'src'].map((name) => newsImageUrl(image.getAttribute(name), item.url)).filter((src): src is string => src !== null && !src.includes('/divider_config/'));
        if (!sources.length) continue;
        const srcSet = providedSrcSet(image.getAttribute('data-srcset') ?? image.getAttribute('srcset'), item.url);
        groups.push({ sources, candidates: [...options(sources[0], srcSet), ...sources.slice(1).flatMap((src) => options(src))] });
      }
    } catch { /* The feed cover still works if article HTML cannot be parsed. */ }
  }
  // Prefer an explicitly declared original of the SAME cover, not an unrelated
  // large image elsewhere in the article. Preserve article order for fallbacks.
  const matching = cover ? groups.find((group) => group.sources.some((src) => identity(src) === identity(cover))) : undefined;
  const candidates = [...(matching?.candidates ?? []), ...(cover ? options(cover) : []), ...groups.filter((group) => group !== matching).flatMap((group) => group.candidates)];
  const seen = new Set<string>();
  const result = candidates.filter((candidate) => {
    const key = `${candidate.src}|${candidate.srcSet ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 12);
  artworkCache.set(item, { image: item.image, html: item.content_html, url: item.url, candidates: result });
  return result;
}
