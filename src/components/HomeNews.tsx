import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play } from 'lucide-react';
import { NewsBannerImage } from './NewsBannerImage';
import { usePageActive } from '../hooks/usePageActive';
import { getJson } from '../api/http';
import { newsImageCandidates, newsImageUrl } from '../utils/newsImages';

interface NewsItem {
  id?: string; url: string; title: string; content_text?: string; content_html?: string;
  image?: string; date_published?: string;
}
const NEWS_FEED_URL = 'https://feeds.c3kay.de/genshin.json';
function formatDate(value?: string) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date) : '';
}

export function HomeNews() {
  const active = usePageActive();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const titleBox = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    void getJson<{ items?: NewsItem[] }>(NEWS_FEED_URL, controller.signal, { cacheKey: 'news:feed:v1', ttlMs: 10 * 60 * 1000, forceRefresh: attempt > 0 }).then((data) => {
      if (controller.signal.aborted) return;
      const news = Array.isArray(data.items) ? data.items.filter((item) => typeof item?.title === 'string' && item.title.trim() && newsImageUrl(item.url)).slice(0, 30) : [];
      setItems(news); setIndex(0); setFailed(!news.length);
    }).catch(() => { if (!controller.signal.aborted) { setItems([]); setFailed(true); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (items.length <= 1 || !active || paused || hovered || focused) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let interval: number | undefined;
    const schedule = () => {
      window.clearInterval(interval);
      if (!motion.matches) interval = window.setInterval(() => {
        // Preference changes can precede the queued media-change event.
        if (!motion.matches) setIndex((current) => (current + 1) % items.length);
      }, 6000);
    };
    schedule(); motion.addEventListener('change', schedule);
    return () => { window.clearInterval(interval); motion.removeEventListener('change', schedule); };
  }, [items.length, active, paused, hovered, focused]);
  const featured = items[index] ?? items[0];
  const candidates = useMemo(() => featured ? newsImageCandidates(featured) : [], [featured]);
  const date = formatDate(featured?.date_published);
  useEffect(() => {
    const heading = title.current, box = titleBox.current;
    if (!heading || !box) return;
    let frame = 0, lastSize = '';
    const fit = () => {
      frame = 0;
      const size = `${box.clientWidth}:${box.clientHeight}`;
      if (size === lastSize) return;
      lastSize = size;
      let low = 17, high = 36, best = 17;
      while (low <= high) {
        const font = Math.floor((low + high) / 2);
        heading.style.fontSize = `${font}px`;
        if (heading.scrollHeight <= box.clientHeight) { best = font; low = font + 1; } else high = font - 1;
      }
      heading.style.fontSize = `${best}px`;
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(fit); };
    schedule();
    const observer = window.ResizeObserver ? new ResizeObserver(schedule) : null;
    observer?.observe(box); window.addEventListener('resize', schedule);
    return () => { window.cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', schedule); };
  }, [featured?.title, loading]);
  function navigate(offset: number) { setPaused(true); setIndex((current) => (current + offset + items.length) % items.length); }
  return <div className="home-news-shell"><section className="home-news" aria-label="Genshin news" aria-busy={loading} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
    {loading ? <div className="home-news-state" role="status"><span className="eyebrow">GENSHIN NEWS</span><p>Loading Genshin news…</p></div> : failed || !featured ? <div className="home-news-state"><span className="eyebrow">GENSHIN NEWS</span><h2>News is temporarily unavailable</h2><p>Your player tools are still ready below.</p><button type="button" className="button secondary" onClick={() => setAttempt((current) => current + 1)}>Retry news</button></div> : <article className="home-news-article">
      <NewsBannerImage key={featured.url ?? featured.id ?? index} candidates={candidates} />
      <div className="home-news-copy"><div className="eyebrow">GENSHIN NEWS</div><div className="home-news-title" ref={titleBox}><h2 ref={title}>{featured.title}</h2></div><div className="home-news-meta">{date && <time dateTime={featured.date_published}>{date}</time>}<a href={newsImageUrl(featured.url) ?? undefined} target="_blank" rel="noreferrer">Read article <ExternalLink size={14} aria-hidden="true" /></a></div>
        {items.length > 1 && <div className="home-news-controls"><span aria-live="off">{index + 1} / {items.length}</span><div><button type="button" className="icon-button" aria-label="Previous news" onClick={() => navigate(-1)}><ChevronLeft size={17} aria-hidden="true" /></button><button type="button" className="icon-button" aria-label={paused ? 'Resume news rotation' : 'Pause news rotation'} aria-pressed={paused} onClick={() => setPaused((current) => !current)}>{paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button><button type="button" className="icon-button" aria-label="Next news" onClick={() => navigate(1)}><ChevronRight size={17} aria-hidden="true" /></button></div></div>}
      </div>
    </article>}
  </section></div>;
}
