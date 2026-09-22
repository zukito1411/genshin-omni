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
  Swords,
  Users,
  Sparkles,
  ExternalLink,
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
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return null;
}

function extractArticleImages(
  contentHtml: string | undefined,
): string[] {
  if (!contentHtml) {
    return [];
  }

  if (typeof DOMParser === 'undefined') {
    return [];
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(
    contentHtml,
    'text/html',
  );

  const images = Array.from(
    document.querySelectorAll('img'),
  );

  return images
    .flatMap((image) => [
      image.getAttribute('src'),
      image.getAttribute('data-src'),
      image.getAttribute('data-original'),
      image.getAttribute('data-lazy-src'),
    ])
    .map((value) =>
      normalizeImageUrl(value ?? undefined),
    )
    .filter(
      (
        value,
      ): value is string =>
        Boolean(value),
    );
}

function getNewsImageCandidates(
  item: GenshinNewsItem,
): string[] {
  const candidates = [
    normalizeImageUrl(item.image),
    ...extractArticleImages(
      item.content_html,
    ),
  ].filter(
    (
      value,
    ): value is string =>
      Boolean(value),
  );

  return Array.from(
    new Set(candidates),
  );
}

function formatNewsDate(
  value: string | undefined,
): string {
  if (!value) {
    return 'Latest news';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Latest news';
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
  ] = useState<GenshinNewsItem[]>([]);

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
      setNewsLoading(true);
      setNewsError(false);

      try {
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

        if (!response.ok) {
          throw new Error(
            `News feed returned ${response.status}`,
          );
        }

        const data =
          (await response.json()) as GenshinNewsFeed;

        const items = Array.isArray(
          data.items,
        )
          ? data.items.filter(
              (item) =>
                Boolean(
                  item.title?.trim(),
                ) &&
                Boolean(
                  item.url?.trim(),
                ),
            )
          : [];

        if (cancelled) {
          return;
        }

        setNews(items);
        setNewsIndex(0);
        setNewsImageIndex(0);

        if (!items.length) {
          setNewsError(true);
        }
      } catch {
        if (cancelled) {
          return;
        }

        setNews([]);
        setNewsIndex(0);
        setNewsImageIndex(0);
        setNewsError(true);
      } finally {
        if (!cancelled) {
          setNewsLoading(false);
        }
      }
    }

    void loadNews();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (news.length <= 1) {
      return;
    }

    const interval =
      window.setInterval(() => {
        setNewsIndex(
          (current) =>
            (current + 1) %
            news.length,
        );

        setNewsImageIndex(0);
      }, NEWS_ROTATION_MS);

    return () =>
      window.clearInterval(
        interval,
      );
  }, [news.length]);

  useEffect(() => {
    if (
      newsIndex >=
      news.length
    ) {
      setNewsIndex(0);
    }
  }, [
    newsIndex,
    news.length,
  ]);

  const featuredNews =
    news[newsIndex];

  const newsImageCandidates =
    useMemo(() => {
      if (!featuredNews) {
        return [];
      }

      return getNewsImageCandidates(
        featuredNews,
      );
    }, [featuredNews]);

  useEffect(() => {
    setNewsImageIndex(0);
  }, [
    featuredNews?.id,
    featuredNews?.url,
    featuredNews?.image,
  ]);

  const currentNewsImage =
    newsImageCandidates[
      newsImageIndex
    ];

  return (
    <div className="home-page">
      {/* Main hero */}
      <section className="hero-card home-hero">
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

        <div className="home-hero__art-shell">
          <div className="home-hero__sun" />

          <div className="hero-rings home-hero__rings">
            <span />
            <span />
            <span />
          </div>

          <div
            style={{
              position:
                'absolute',
              inset: 0,
              display: 'flex',
              flexDirection:
                'column',
              justifyContent:
                'flex-end',
              overflow: 'hidden',
              padding:
                'clamp(18px, 3vw, 32px)',
            }}
          >
            {newsLoading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  height: '100%',
                  textAlign:
                    'center',
                  padding: '24px',
                }}
              >
                <div>
                  <div className="eyebrow">
                    GENSHIN NEWS
                  </div>

                  <h2>
                    Loading latest news…
                  </h2>
                </div>
              </div>
            ) : featuredNews ? (
              <>
                {currentNewsImage && (
                  <img
                    src={
                      currentNewsImage
                    }
                    alt=""
                    aria-hidden="true"
                    className="home-hero__character"
                    onError={() => {
                      setNewsImageIndex(
                        (current) =>
                          current + 1,
                      );
                    }}
                  />
                )}

                <div
                  style={{
                    position:
                      'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(180deg, rgba(4, 10, 17, 0.02) 25%, rgba(4, 10, 17, 0.82) 100%)',
                    pointerEvents:
                      'none',
                  }}
                />

                <div
                  style={{
                    position:
                      'relative',
                    zIndex: 2,
                    maxWidth:
                      '720px',
                  }}
                >
                  <div className="eyebrow">
                    GENSHIN NEWS
                  </div>

                  <h2
                    style={{
                      margin:
                        '6px 0 8px',
                    }}
                  >
                    {featuredNews.title}
                  </h2>

                  <div
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: '10px',
                      flexWrap:
                        'wrap',
                    }}
                  >
                    <small>
                      {formatNewsDate(
                        featuredNews.date_published,
                      )}
                    </small>

                    {featuredNews.url && (
                      <a
                        href={
                          featuredNews.url
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-source"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        Read article
                        <ExternalLink
                          size={12}
                        />
                      </a>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  height: '100%',
                  textAlign:
                    'center',
                  padding: '24px',
                }}
              >
                <div>
                  <div className="eyebrow">
                    GENSHIN NEWS
                  </div>

                  <h2>
                    News is temporarily
                    unavailable.
                  </h2>

                  <p>
                    The live news source
                    could not be reached.
                  </p>
                </div>
              </div>
            )}

            {newsError &&
              featuredNews && (
                <div
                  style={{
                    position:
                      'absolute',
                    top: '16px',
                    right: '16px',
                    zIndex: 3,
                    fontSize:
                      '10px',
                    opacity: 0.65,
                  }}
                >
                  Live feed
                </div>
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
                display:
                  'flex',
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
                display:
                  'flex',
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
                display:
                  'flex',
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
                  whiteSpace:
                    'nowrap',
                }}
              >
                Make a team
              </strong>

              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="callout home-callout"
        style={{
          display:
            'flex',
          alignItems:
            'center',
          justifyContent:
            'space-between',
          gap: '24px',
        }}
      >
        <div
          style={{
            flex: 1,
          }}
        >
          <div className="eyebrow">
            READY TO BUILD?
          </div>

          <h3>
            Pick a character
            and see everything
            you need to build
            them.
          </h3>

          <p>
            Check their weapons,
            artifacts, talents,
            teams, and materials
            in one place.
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
