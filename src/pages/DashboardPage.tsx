import {
  useEffect,
  useMemo,
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

const NEWS_FEED_URL =
  'https://feeds.c3kay.de/genshin.json';

const NEWS_ROTATION_MS = 6000;

function normalizeImageUrl(
  value?: string,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith(
      '//',
    )
  ) {
    return `https:${trimmed}`;
  }

  try {
    const url =
      new URL(trimmed);

    if (
      url.protocol ===
        'http:' ||
      url.protocol ===
        'https:'
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function extractArticleImages(
  html?: string,
): string[] {
  if (!html) {
    return [];
  }

  try {
    const parser =
      new DOMParser();

    const document =
      parser.parseFromString(
        html,
        'text/html',
      );

    const images =
      Array.from(
        document.querySelectorAll(
          'img',
        ),
      );

    return images
      .flatMap(
        (image) => [
          image.getAttribute(
            'src',
          ),
          image.getAttribute(
            'data-src',
          ),
          image.getAttribute(
            'data-original',
          ),
          image.getAttribute(
            'data-lazy-src',
          ),
        ],
      )
      .map(
        (value) =>
          normalizeImageUrl(
            value ?? undefined,
          ),
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      );
  } catch {
    return [];
  }
}

function getNewsImageCandidates(
  item: GenshinNewsItem,
): string[] {
  const candidates = [
    normalizeImageUrl(
      item.image,
    ),
    ...extractArticleImages(
      item.content_html,
    ),
  ];

  return Array.from(
    new Set(
      candidates.filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      ),
    ),
  );
}

function formatNewsDate(
  value?: string,
): string {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  ).format(date);
}

export function DashboardPage() {
  const {
    allCharacters,
    loading,
  } = useCharacters('');

  const favorites = useMemo(
    () =>
      allCharacters
        .filter(
          (character) =>
            localStorage.getItem(
              `favorite:${character.id}`,
            ) === '1',
        )
        .slice(0, 6),
    [allCharacters],
  );

  const [
    news,
    setNews,
  ] = useState<
    GenshinNewsItem[]
  >([]);

  const [
    newsIndex,
    setNewsIndex,
  ] = useState(0);

  const [
    newsLoading,
    setNewsLoading,
  ] = useState(true);

  const [
    newsError,
    setNewsError,
  ] = useState(false);

  const [
    newsImageIndex,
    setNewsImageIndex,
  ] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      try {
        setNewsLoading(true);
        setNewsError(false);

        const response =
          await fetch(
            NEWS_FEED_URL,
            {
              headers: {
                Accept:
                  'application/json',
              },
            },
          );

        if (
          !response.ok
        ) {
          throw new Error(
            `News request failed: ${response.status}`,
          );
        }

        const data =
          (await response.json()) as GenshinNewsFeed;

        if (cancelled) {
          return;
        }

        const items =
          Array.isArray(
            data.items,
          )
            ? data.items.filter(
                (item) =>
                  Boolean(
                    item.title,
                  ) &&
                  Boolean(
                    item.url,
                  ),
              )
            : [];

        setNews(items);
        setNewsIndex(0);
        setNewsImageIndex(0);

        if (
          !items.length
        ) {
          setNewsError(true);
        }
      } catch {
        if (!cancelled) {
          setNews([]);
          setNewsError(true);
        }
      } finally {
        if (!cancelled) {
          setNewsLoading(false);
        }
      }
    }

    loadNews();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      news.length <= 1
    ) {
      return;
    }

    const interval =
      window.setInterval(() => {
        setNewsIndex(
          (current) =>
            (current + 1) %
            news.length,
        );
      }, NEWS_ROTATION_MS);

    return () =>
      window.clearInterval(
        interval,
      );
  }, [news.length]);

  useEffect(() => {
    setNewsImageIndex(0);
  }, [newsIndex]);

  const featuredNews =
    news[newsIndex] ??
    news[0];

  const newsImageCandidates =
    featuredNews
      ? getNewsImageCandidates(
          featuredNews,
        )
      : [];

  const currentNewsImage =
    newsImageCandidates[
      newsImageIndex
    ];

  useEffect(() => {
    if (
      newsImageIndex <
      newsImageCandidates.length
    ) {
      return;
    }

    setNewsImageIndex(0);
  }, [
    newsImageIndex,
    newsImageCandidates.length,
  ]);

  return (
    <div className="home-page">
      {/* Main hero */}
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
            Find builds, weapons,
            artifacts, teams,
            materials, and more
            in one place.
          </p>

          <div className="hero-actions">
            <Link
              to="/characters"
              className="button primary"
            >
              Browse Characters
              <ArrowRight size={15} />
            </Link>

            <Link
              to="/teams"
              className="button secondary"
            >
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

              <span>
                elements
              </span>
            </div>

            <div>
              <strong>∞</strong>

              <span>
                builds to explore
              </span>
            </div>
          </div>
        </div>

        {/* Automatic Genshin news */}
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
              background:
                'rgba(4, 12, 21, 0.72)',
              border:
                '1px solid rgba(213, 190, 125, 0.28)',
              boxShadow:
                '0 20px 60px rgba(0, 0, 0, 0.28)',
            }}
          >
            {newsLoading ? (
              <div
                style={{
                  minHeight:
                    '320px',
                  display: 'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  padding:
                    '32px 24px',
                  boxSizing:
                    'border-box',
                }}
              >
                <span
                  style={{
                    color:
                      'rgba(220, 232, 245, 0.72)',
                    fontSize:
                      '0.95rem',
                  }}
                >
                  Loading Genshin News...
                </span>
              </div>
            ) : newsError ||
              !featuredNews ? (
              <div
                style={{
                  minHeight:
                    '320px',
                  display: 'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  padding:
                    '32px 24px',
                  boxSizing:
                    'border-box',
                  textAlign:
                    'center',
                }}
              >
                <div>
                  <div
                    style={{
                      color:
                        'rgba(220, 232, 245, 0.9)',
                      fontSize:
                        '1.05rem',
                      marginBottom:
                        '8px',
                    }}
                  >
                    Genshin News
                  </div>

                  <div
                    style={{
                      color:
                        'rgba(180, 198, 218, 0.68)',
                      fontSize:
                        '0.9rem',
                    }}
                  >
                    News is temporarily
                    unavailable.
                  </div>
                </div>
              </div>
            ) : (
              <article
                style={{
                  width: '100%',
                  minWidth: 0,
                  boxSizing:
                    'border-box',
                }}
              >
                {currentNewsImage && (
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      lineHeight: 0,
                      background:
                        'rgba(0, 0, 0, 0.25)',
                    }}
                  >
                    <img
                      src={
                        currentNewsImage
                      }
                      alt=""
                      aria-hidden="true"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: 'auto',
                        maxWidth: '100%',
                        objectFit:
                          'contain',
                      }}
                      onError={() => {
                        setNewsImageIndex(
                          (current) =>
                            current + 1,
                        );
                      }}
                    />
                  </div>
                )}

                <div
                  style={{
                    padding:
                      '22px 24px 24px',
                    boxSizing:
                      'border-box',
                  }}
                >
                  <div
                    style={{
                      marginBottom:
                        '10px',
                      color:
                        '#8fb4dc',
                      fontSize:
                        '0.78rem',
                      fontWeight: 600,
                      letterSpacing:
                        '0.2em',
                    }}
                  >
                    GENSHIN NEWS
                  </div>

                  <h2
                    style={{
                      margin:
                        '0 0 18px',
                      color:
                        '#f2f5f8',
                      fontSize:
                        'clamp(1.35rem, 3vw, 2.25rem)',
                      lineHeight:
                        1.18,
                      fontWeight: 600,
                      overflowWrap:
                        'anywhere',
                    }}
                  >
                    {featuredNews.title}
                  </h2>

                  <div
                    style={{
                      display: 'flex',
                      alignItems:
                        'center',
                      flexWrap:
                        'wrap',
                      gap:
                        '14px',
                    }}
                  >
                    {featuredNews.date_published && (
                      <span
                        style={{
                          color:
                            'rgba(220, 232, 245, 0.78)',
                          fontSize:
                            '0.9rem',
                        }}
                      >
                        {formatNewsDate(
                          featuredNews.date_published,
                        )}
                      </span>
                    )}

                    <a
                      href={
                        featuredNews.url
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display:
                          'inline-flex',
                        alignItems:
                          'center',
                        gap: '6px',
                        color:
                          '#9dbdff',
                        fontSize:
                          '0.9rem',
                        textDecoration:
                          'none',
                      }}
                    >
                      Read article
                      <ExternalLink
                        size={14}
                      />
                    </a>
                  </div>
                </div>
              </article>
            )}
          </div>
        </div>
      </section>

      {/* Main tools */}
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

            <h3>
              Characters
            </h3>

            <p>
              See builds, stats,
              talents, teams, and
              materials for every
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

            <h3>
              Weapons
            </h3>

            <p>
              Check weapon stats
              and find weapons
              that fit your
              characters.
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

            <h3>
              Artifacts
            </h3>

            <p>
              Check artifact
              sets, bonuses, and
              which characters use
              them.
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

            <h3>
              Team Builder
            </h3>

            <p>
              Put four characters
              together and save
              the teams you want
              to try.
            </p>

            <span>
              Build a team
              <ArrowRight size={13} />
            </span>
          </Link>
        </div>
      </section>

      {/* Quick access */}
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
                alignItems:
                  'center',
                gap: '10px',
                width: '100%',
                textDecoration:
                  'none',
              }}
            >
              <Compass size={15} />

              <span
                style={{
                  flex: 1,
                }}
              >
                Map
              </span>

              <strong
                style={{
                  fontWeight: 500,
                  whiteSpace:
                    'nowrap',
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
                alignItems:
                  'center',
                gap: '10px',
                width: '100%',
                textDecoration:
                  'none',
              }}
            >
              <BookOpen size={15} />

              <span
                style={{
                  flex: 1,
                }}
              >
                Guides
              </span>

              <strong
                style={{
                  fontWeight: 500,
                  whiteSpace:
                    'nowrap',
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
                alignItems:
                  'center',
                gap: '10px',
                width: '100%',
                textDecoration:
                  'none',
              }}
            >
              <Users size={15} />

              <span
                style={{
                  flex: 1,
                }}
              >
                Teams
              </span>

              <strong
                style={{
                  fontWeight: 500,
                  whiteSpac
