import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Boxes, Compass, Swords, Users, Sparkles } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import { assetKey, characterImageSources } from '../api/genshinDev';
import { useCharacters } from '../hooks/useCharacters';

export function DashboardPage() {
  const { allCharacters, loading } = useCharacters('');

  const favorites = allCharacters
    .filter((character) => localStorage.getItem(`favorite:${character.id}`) === '1')
    .slice(0, 6);

  const featured = favorites[0] ?? allCharacters[0];

  const featuredImages = featured
    ? characterImageSources(featured, 'portrait')
    : [];

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
            Build your characters. Plan your adventure.
          </h1>

          <p className="hero-description">
            Find builds, weapons, artifacts, teams, materials, and more in one place.
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
              <strong>{loading ? '—' : allCharacters.length}</strong>
              <span>characters</span>
            </div>

            <div>
              <strong>7</strong>
              <span>elements</span>
            </div>

            <div>
              <strong>∞</strong>
              <span>builds to explore</span>
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

          {featured && (
            <AsyncImage
              src={featuredImages}
              alt={featured.name}
              className="home-hero__character"
              assetKey={assetKey(
                'characters',
                featured.id || featured.name,
              )}
            />
          )}

          <div className="home-hero__caption">
            <span>
              {featured ? featured.name : 'Teyvat Atlas'}
            </span>

            <small>
              {featured
                ? `${featured.element ?? 'Unknown'} · ${featured.weapon ?? 'Character'}`
                : 'Your Genshin companion'}
            </small>
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

            <h3>Characters</h3>

            <p>
              See builds, stats, talents, teams, and materials for every character.
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
              Put four characters together and save the teams you want to try.
            </p>

            <span>
              Build a team
              <ArrowRight size={13} />
            </span>
          </Link>
        </div>
      </section>

      {/* Saved characters and quick access */}
      <br></br>
        <section className="panel home-panel home-panel--sources">
          <div className="panel-ornament" />

          <SectionTitle
            eyebrow="QUICK ACCESS"
            title="Keep playing"
            description="Jump straight to the tools you need."
          />

          <div className="health-list">
            {/* Keep the existing div structure so the current CSS still applies. */}

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

      {/* Final CTA */}
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
            Check their weapons, artifacts, talents, teams, and materials in one place.
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