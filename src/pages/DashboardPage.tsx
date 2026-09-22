import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Compass,
  ExternalLink,
  Swords,
  Users,
  Sparkles,
} from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { useCharacters } from '../hooks/useCharacters';

interface GenshinNewsItem {
  id?: string;
  url?: string;
  title?: string;
  content_text?: string;
  content_html?: string;
  image?: string;
  date_published?: string;
}

interface GenshinNewsFeed {
  version?: string;
  title?: string;
  items?: GenshinNewsItem[];
}

const NEWS_FEED_URL = 'https://feeds.c3kay.de/genshin.json';
const NEWS_ROTATION_MS = 6000;

function normalizeImageUrl(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function extractArticleImages(html?: string): string[] {
  if (!html) return [];

  try {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const images = Array.from(document.querySelectorAll('img'));

    return images
      .flatMap((image) => [
        image.getAttribute('src'),
        image.getAttribute('data-src'),
        image.getAttribute('data-original'),
        image.getAttribute('data-lazy-src'),
      ])
      .map((value) => normalizeImageUrl(value ?? undefined))
      .filter((value): value is string => Boolean(value));
  } catch {
    return [];
  }
}

function getNewsImageCandidates(item: GenshinNewsItem): string[] {
  return Array.from(
    new Set(
      [
        normalizeImageUrl(item.image),
        ...extractArticleImages(item.content_html),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

function formatNewsDate(value?: string): string {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function DashboardPage() {
  const { allCharacters, loading } = useCharacters('');

  const favorites = useMemo(
    () =>
      allCharacters
        .filter(
          (character) =>
            localStorage.getItem(`favorite:${character.id}`) === '1',
        )
        .slice(0, 6),
    [allCharacters],
  );

  const slideshowCharacters =
    useMemo(() => {
      if (!allCharacters.length) {
        return [];
      }

      const favoriteIds =
        new Set(
          favorites.map(
            (character) =>
              character.id,
          ),
        );

      const remainingCharacters =
        allCharacters.filter(
          (character) =>
            !favoriteIds.has(
              character.id,
            ),
        );

      return [
        ...favorites,
        ...remainingCharacters,
      ];
    }, [
      allCharacters,
      favorites,
    ]);

  const [
    slideIndex,
    setSlideIndex,
  ] = useState(0);

  const [
    isTransitioning,
    setIsTransitioning,
  ] = useState(false);

  useEffect(() => {
    if (
      slideshowCharacters.length <= 1
    ) {
      return;
    }

    const interval =
      window.setInterval(() => {
        setIsTransitioning(true);

        window.setTimeout(() => {
          setSlideIndex(
            (current) =>
              (current + 1) %
              slideshowCharacters.length,
          );

          setIsTransitioning(false);
        }, 350);
      }, 5000);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (news.length <= 1) return;

    const interval = window.setInterval(() => {
      setNewsIndex((current) => (current + 1) % news.length);
    }, NEWS_ROTATION_MS);

    return () => window.clearInterval(interval);
  }, [news.length]);

  useEffect(() => {
    if (
      slideIndex >=
      slideshowCharacters.length
    ) {
      setSlideIndex(0);
    }
  }, [
    slideIndex,
    slideshowCharacters.length,
  ]);

  const featured =
    slideshowCharacters[
    slideIndex
    ] ??
    slideshowCharacters[0];

  const featuredImages =
    featured
      ? characterImageSources(
        featured,
        'card',
      )
      : [];

  return (
    <div className="home-page">
      <section
        className="hero-card home-hero"
        style={{
          overflow: 'hidden',
        }}
      >
        <div className="home-hero__veil" />

        <div className="hero-copy home-hero__copy">
          <div className="eyebrow hero-eyebrow">
            <Sparkles size={13} />
            TEYVAT ATLAS
          </div>

          <div className="hero-kicker">
            GENSHIN IMPACT COMPANION
          </div>

          <h1>
            Build your characters.
            Plan your adventure.
          </h1>

          <p className="hero-description">
            Find builds, weapons, artifacts, teams, materials, and more in
            one place.
          </p>

          <div className="hero-actions">
            <Link to="/characters" className="button primary">
              Browse Characters
              <ArrowRight size={15} />
            </Link>

            <Link to="/teams" className="button secondary">
              Build a Team
            </Link>
          </div>

          <div className="hero-stats">
            <div>
              <strong>
                {loading
                  ? '—'
                  : allCharacters.length}
              </strong>

              <span>
                characters
              </span>
            </div>

            <div>
              <strong>7</strong>
              <span>elements</span>
            </div>

            <div>
              <strong>∞</strong>

              <span>
                builds to explore
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            minWidth: 0,
            alignSelf: 'stretch',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              minWidth: 0,
              boxSizing: 'border-box',
              overflow: 'hidden',
              borderRadius: '2px',
              background: 'rgba(4, 12, 21, 0.72)',
              border: '1px solid rgba(213, 190, 125, 0.28)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.28)',
            }}
          >
            {newsLoading ? (
              <div
                style={{
                  minHeight: '320px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px 24px',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    color: 'rgba(220, 232, 245, 0.72)',
                    fontSize: '0.95rem',
                  }}
                >
                  Loading Genshin News...
                </span>

                <small>
                  {`${featured.element ?? 'Unknown'} · ${featured.weapon ?? 'Character'}`}
                </small>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section-block home-tools">
        <SectionTitle
          eyebrow="EXPLORE"
          title="What do you want to do?"
          description="Find a character, check a build, prepare materials, or put together a team."
        />

        <div className="feature-grid four">
          <Link
            to="/characters"
            className="feature-card feature-card--character"
          >
            <Users />
            <h3>Characters</h3>
            <p>
              See builds, stats, talents, teams, and materials for every
              character.
            </p>
            <span>
              Browse characters
              <ArrowRight size={13} />
            </span>
          </Link>

          <Link
            to="/weapons"
            className="feature-card feature-card--weapon"
          >
            <Swords />
            <h3>Weapons</h3>
            <p>
              Check weapon stats and find weapons that fit your characters.
            </p>
            <span>
              Browse weapons
              <ArrowRight size={13} />
            </span>
          </Link>

          <Link
            to="/artifacts"
            className="feature-card feature-card--artifact"
          >
            <Boxes />
            <h3>Artifacts</h3>
            <p>
              Check artifact sets, bonuses, and which characters use them.
            </p>
            <span>
              Browse artifacts
              <ArrowRight size={13} />
            </span>
          </Link>

          <Link
            to="/teams"
            className="feature-card feature-card--team"
          >
            <BookOpen />
            <h3>Team Builder</h3>
            <p>
              Put four characters together and save the teams you want to
              try.
            </p>
            <span>
              Build a team
              <ArrowRight size={13} />
            </span>
          </Link>
        </div>
      </section>

      <br />

      <section className="panel home-panel home-panel--sources">
        <div className="panel-ornament" />

        <SectionTitle
          eyebrow="QUICK ACCESS"
          title="Keep playing"
          description="Jump straight to the tools you need."
        />

        <div className="health-list">
          <div>
            <Link
              to="/map"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                textDecoration: 'none',
              }}
            >
              <Compass size={15} />

              <span style={{ flex: 1 }}>
                Map
              </span>

              <strong
                style={{
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Find resources
              </strong>

              <ArrowRight size={13} />
            </Link>
          </div>

          <div>
            <Link
              to="/guides"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                textDecoration: 'none',
              }}
            >
              <BookOpen size={15} />

              <span style={{ flex: 1 }}>
                Guides
              </span>

              <strong
                style={{
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Learn more
              </strong>

              <ArrowRight size={13} />
            </Link>
          </div>

          <div>
            <Link
              to="/teams"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                textDecoration: 'none',
              }}
            >
              <Users size={15} />

              <span style={{ flex: 1 }}>
                Teams
              </span>

              <strong
                style={{
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Make a team
              </strong>

              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      <section
        className="callout home-callout"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        <div style={{ flex: 1 }}>
          <div className="eyebrow">
            READY TO BUILD?
          </div>

          <h3>
            Pick a character and see everything you need to build them.
          </h3>

          <p>
            Check their weapons, artifacts, talents, teams, and materials in
            one place.
          </p>
        </div>

        <Link
          className="button secondary"
          to="/characters"
          style={{
            flex: '0 0 auto',
          }}
        >
          Browse Characters
          <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  );
                  }
