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
  Swords,
  Users,
  Sparkles,
} from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import {
  assetKey,
  characterImageSources,
} from '../api/genshinDev';
import { useCharacters } from '../hooks/useCharacters';

type PaimonAction =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review';

const PAIMON_AFK_TIME = 1 * 60 * 1000;
const PAIMON_ANGER_HIDE_TIME = 10 * 1000;
const PAIMON_MOVE_DURATION = 1800;

function PaimonCompanion() {
  const [visible, setVisible] = useState(true);

  const [presence, setPresence] = useState<
    'visible' | 'entering' | 'exiting'
  >('visible');

  const [action, setAction] =
    useState<PaimonAction>('idle');

  const [frame, setFrame] = useState(0);

  const [position, setPosition] = useState({
    x: 74,
    y: 65,
  });

  const [isAfk, setIsAfk] = useState(false);

  const [speech, setSpeech] = useState(
    'How are you doing?',
  );

  const actionTimeoutRef =
    useRef<number | null>(null);

  const movementTimeoutRef =
    useRef<number | null>(null);

  const afkTimeoutRef =
    useRef<number | null>(null);

  const normalBehaviorTimeoutRef =
    useRef<number | null>(null);

  const popOutTimeoutRef =
    useRef<number | null>(null);

  const popInTimeoutRef =
    useRef<number | null>(null);

  const clickTimesRef =
    useRef<number[]>([]);

  const actionBusyRef =
    useRef(false);

  const visibleRef =
    useRef(visible);

  const isAfkRef =
    useRef(isAfk);

  const presenceRef =
    useRef(presence);

  visibleRef.current = visible;
  isAfkRef.current = isAfk;
  presenceRef.current = presence;

  const spriteRows: Record<PaimonAction, number> = {
    idle: 0,
    'running-right': 1,
    'running-left': 2,
    waving: 3,
    jumping: 4,
    failed: 5,
    waiting: 6,
    running: 1,
    review: 7,
  };

  function clearActionTimeout() {
    if (actionTimeoutRef.current !== null) {
      window.clearTimeout(
        actionTimeoutRef.current,
      );

      actionTimeoutRef.current = null;
    }
  }

  function clearMovementTimeout() {
    if (movementTimeoutRef.current !== null) {
      window.clearTimeout(
        movementTimeoutRef.current,
      );

      movementTimeoutRef.current = null;
    }
  }

  function clearAfkTimeout() {
    if (afkTimeoutRef.current !== null) {
      window.clearTimeout(
        afkTimeoutRef.current,
      );

      afkTimeoutRef.current = null;
    }
  }

  function clearNormalBehaviorTimeout() {
    if (
      normalBehaviorTimeoutRef.current !== null
    ) {
      window.clearTimeout(
        normalBehaviorTimeoutRef.current,
      );

      normalBehaviorTimeoutRef.current = null;
    }
  }

  function clearPresenceTimeouts() {
    if (popOutTimeoutRef.current !== null) {
      window.clearTimeout(
        popOutTimeoutRef.current,
      );

      popOutTimeoutRef.current = null;
    }

    if (popInTimeoutRef.current !== null) {
      window.clearTimeout(
        popInTimeoutRef.current,
      );

      popInTimeoutRef.current = null;
    }
  }

  function getRandomPaimonLine() {
    const lines = [
      'How are you doing?',
      'What are we gonna do today?',
      'Where should we go first?',
      'Paimon thinks we should explore!',
      'Hmm... what should we do next?',
      'Paimon is ready!',
      'Treasure hunting?',
      'Paimon wants to go too!',
      'Where do you think we should go?',
      'Paimon wonders what is nearby...',
      'There is still so much to explore!',
      'Paimon could really use a snack...',
      'Hmmmm... what should we do?',
      'Paimon has a good feeling about today!',
      'Should we check the map?',
      'Paimon is thinking...',
      'Did you bring snacks?',
      'Paimon is not emergency food!',
      'What are we building today?',
      'Paimon wants to see!',
    ];

    return lines[
      Math.floor(
        Math.random() * lines.length,
      )
    ];
  }

  function getRandomTrivia() {
    const trivia = [
      'Teyvat has seven elements.',
      'Paimon can float instead of walking.',
      'Every elemental reaction begins with elemental application.',
      'There are seven nations across Teyvat.',
      'The Traveler can use different elements.',
      'Paimon loves treasure chests!',
    ];

    return trivia[
      Math.floor(
        Math.random() * trivia.length,
      )
    ];
  }

  function playTemporaryAction(
    nextAction: PaimonAction,
    duration = 1200,
    nextSpeech?: string,
  ) {
    clearActionTimeout();
    clearMovementTimeout();

    actionBusyRef.current = true;

    setFrame(0);
    setAction(nextAction);

    actionTimeoutRef.current =
      window.setTimeout(() => {
        actionBusyRef.current = false;

        setFrame(0);
        setAction('idle');

        setSpeech(
          nextSpeech ??
          getRandomPaimonLine(),
        );

        actionTimeoutRef.current = null;
      }, duration);
  }

  function resetAfkTimer() {
    setIsAfk(false);

    clearAfkTimeout();

    afkTimeoutRef.current =
      window.setTimeout(() => {
        if (!visibleRef.current) return;

        setIsAfk(true);
        setFrame(0);
        setAction('waiting');

        const messages = [
          'Traveler... are you still there?',
          'Paimon is getting bored...',
          'Where did you go?',
          'Hmm... maybe Paimon should find some food.',
          'Traveler? Paimon is still here!',
          'Are we going somewhere today?',
          'Paimon is waiting...',
          'Did you fall asleep?',
          'Paimon is still here, you know!',
        ];

        setSpeech(
          messages[
          Math.floor(
            Math.random() *
            messages.length,
          )
          ],
        );
      }, PAIMON_AFK_TIME);
  }

  function moveToRandomSpot() {
    if (!visibleRef.current) return;
    if (presenceRef.current !== 'visible') return;
    if (actionBusyRef.current) return;

    const spots = [
      { x: 6, y: 64 },
      { x: 74, y: 65 },
      { x: 76, y: 18 },
      { x: 8, y: 17 },
      { x: 45, y: 70 },
      { x: 48, y: 10 },
    ];

    setPosition((current) => {
      const candidates = spots.filter(
        (spot) =>
          Math.abs(
            spot.x - current.x,
          ) > 15 ||
          Math.abs(
            spot.y - current.y,
          ) > 15,
      );

      const next =
        candidates[
        Math.floor(
          Math.random() *
          candidates.length,
        )
        ] ?? spots[0];

      clearMovementTimeout();

      setFrame(
        next.x > current.x
          ? 0
          : 6,
      );

      setAction(
        next.x > current.x
          ? 'running-right'
          : 'running-left',
      );

      movementTimeoutRef.current =
        window.setTimeout(() => {
          setFrame(0);

          setAction(
            (currentAction) =>
              currentAction ===
                'running-right' ||
                currentAction ===
                'running-left'
                ? 'idle'
                : currentAction,
          );

          movementTimeoutRef.current = null;
        }, PAIMON_MOVE_DURATION);

      return next;
    });
  }

  function moveNearElement(element: Element) {
    const rect =
      element.getBoundingClientRect();

    const targetX =
      ((rect.left +
        rect.width / 2 -
        95) /
        window.innerWidth) *
      100;

    const targetY =
      ((rect.top - 215) /
        window.innerHeight) *
      100;

    setPosition({
      x: Math.min(
        84,
        Math.max(2, targetX),
      ),
      y: Math.min(
        76,
        Math.max(5, targetY),
      ),
    });
  }

  function runNormalBehavior() {
    if (!visibleRef.current) return;
    if (isAfkRef.current) return;
    if (presenceRef.current !== 'visible') {
      return;
    }

    if (actionBusyRef.current) {
      return;
    }

    /*
     * Trivia gets its own behavior.
     *
     * This guarantees the REVIEW row is
     * actually used whenever Paimon gives
     * a trivia/fact.
     */
    if (Math.random() < 0.35) {
      playTemporaryAction(
        'review',
        3200,
        getRandomTrivia(),
      );

      return;
    }

    const behaviors: Array<{
      action: PaimonAction;
      lines: string[];
      duration: number;
    }> = [
        {
          action: 'idle',
          lines: [
            'Hmmmm...',
            'What should we do next?',
            'Paimon is thinking...',
            'There is still so much to explore!',
            'Where should we go today?',
          ],
          duration: 1800,
        },
        {
          action: 'waiting',
          lines: [
            'Paimon is getting a little hungry...',
            'Do you have any snacks?',
            'Paimon could really use a meal...',
            'Hmm... Paimon wants something to eat.',
            'Paimon hopes there is food nearby...',
          ],
          duration: 2200,
        },
        {
          action: 'waving',
          lines: [
            'Hey, Traveler!',
            'Paimon is still here!',
            'What are we doing today?',
            'Paimon is ready!',
            'Hey! Look at Paimon!',
          ],
          duration: 1700,
        },
        {
          action: 'jumping',
          lines: [
            'Ooh! That looks interesting!',
            'Treasure!',
            'Let’s go!',
            'Paimon has an idea!',
            'Adventure time!',
          ],
          duration: 1400,
        },
      ];

    const behavior =
      behaviors[
      Math.floor(
        Math.random() *
        behaviors.length,
      )
      ];

    const line =
      behavior.lines[
      Math.floor(
        Math.random() *
        behavior.lines.length,
      )
      ];

    playTemporaryAction(
      behavior.action,
      behavior.duration,
      line,
    );
  }

  function scheduleNextNormalBehavior() {
    clearNormalBehaviorTimeout();

    if (!visibleRef.current) return;
    if (isAfkRef.current) return;

    if (
      presenceRef.current !==
      'visible'
    ) {
      return;
    }

    const delay =
      7000 +
      Math.floor(
        Math.random() * 9000,
      );

    normalBehaviorTimeoutRef.current =
      window.setTimeout(() => {
        if (
          !visibleRef.current ||
          isAfkRef.current ||
          presenceRef.current !==
          'visible'
        ) {
          return;
        }

        runNormalBehavior();

        scheduleNextNormalBehavior();
      }, delay);
  }

  function reactToSiteInteraction(
    element: Element,
  ) {
    if (!visibleRef.current) return;

    if (
      presenceRef.current !==
      'visible'
    ) {
      return;
    }

    const tagName =
      element.tagName.toLowerCase();

    const isInteractive =
      tagName === 'button' ||
      tagName === 'a' ||
      tagName === 'select' ||
      element.getAttribute(
        'role',
      ) === 'button';

    if (!isInteractive) return;

    resetAfkTimer();
    moveNearElement(element);

    const messages = [
      'How are you doing?',
      'What are we gonna do today?',
      'Where should we go first?',
      'Paimon thinks we should explore!',
      'Hmm... what should we do next?',
      'Paimon is ready!',
      'Treasure hunting?',
      'Paimon wants to go too!',
      'What are you looking at?',
      'Paimon wants to see!',
    ];

    const facts = [
      'Did you know? Paimon is not emergency food!',
      'Paimon thinks every treasure chest deserves a look!',
      'There are still so many places to explore!',
      'Paimon wonders what we will find next!',
    ];

    const line =
      Math.random() < 0.25
        ? facts[
        Math.floor(
          Math.random() *
          facts.length,
        )
        ]
        : messages[
        Math.floor(
          Math.random() *
          messages.length,
        )
        ];

    playTemporaryAction(
      'waving',
      1400,
      line,
    );
  }

  function handlePaimonClick() {
    if (
      !visible ||
      presence === 'exiting'
    ) {
      return;
    }

    const now = Date.now();

    clickTimesRef.current =
      clickTimesRef.current.filter(
        (time) =>
          now - time < 3000,
      );

    clickTimesRef.current.push(now);

    const clickCount =
      clickTimesRef.current.length;

    /*
     * TEN RAPID CLICKS
     */
    if (clickCount >= 10) {
      clickTimesRef.current = [];

      clearActionTimeout();
      clearMovementTimeout();
      clearAfkTimeout();
      clearNormalBehaviorTimeout();
      clearPresenceTimeouts();

      actionBusyRef.current = true;

      setIsAfk(false);
      setFrame(0);
      setSpeech(
        'ENOUGH! Leave Paimon alone!',
      );
      setAction('failed');
      setPresence('exiting');

      popOutTimeoutRef.current =
        window.setTimeout(() => {
          setVisible(false);
          setPresence('visible');

          popOutTimeoutRef.current =
            null;
        }, 700);

      popInTimeoutRef.current =
        window.setTimeout(() => {
          setVisible(true);
          setFrame(0);
          setAction('idle');

          setSpeech(
            Math.random() < 0.5
              ? 'Paimon is back...'
              : getRandomPaimonLine(),
          );

          setPresence('entering');

          window.setTimeout(() => {
            actionBusyRef.current = false;

            setPresence('visible');

            resetAfkTimer();
            scheduleNextNormalBehavior();
          }, 700);
        }, PAIMON_ANGER_HIDE_TIME + 700);

      return;
    }

    /*
     * THREE RAPID CLICKS
     */
    if (clickCount >= 3) {
      clearActionTimeout();
      clearMovementTimeout();

      resetAfkTimer();

      actionBusyRef.current = true;

      setIsAfk(false);
      setFrame(0);

      setSpeech(
        clickCount === 3
          ? 'HEY! Stop poking Paimon!'
          : 'Paimon said STOP!',
      );

      setAction('failed');

      actionTimeoutRef.current =
        window.setTimeout(() => {
          actionBusyRef.current = false;

          setFrame(0);
          setAction('idle');
          setSpeech(
            getRandomPaimonLine(),
          );

          actionTimeoutRef.current = null;

          scheduleNextNormalBehavior();
        }, 1800);

      return;
    }

    /*
     * NORMAL POKE
     */
    resetAfkTimer();

    const reactions = [
      {
        text: 'Why are you poking Paimon?',
        action: 'waving' as PaimonAction,
      },
      {
        text: 'What?',
        action: 'jumping' as PaimonAction,
      },
      {
        text: 'Did you need something?',
        action: 'waiting' as PaimonAction,
      },
      {
        text: 'Paimon is watching you...',
        action: 'review' as PaimonAction,
      },
      {
        text: 'Hey!',
        action: 'waving' as PaimonAction,
      },
    ];

    const reaction =
      reactions[
      Math.floor(
        Math.random() *
        reactions.length,
      )
      ];

    playTemporaryAction(
      reaction.action,
      1200,
      reaction.text,
    );
  }

  /*
   * FRAME PLAYER
   *
   * Directional movement:
   * right = frames 0, 1
   * left  = frames 6, 7
   *
   * Everything else:
   * frames 0–7
   */
  useEffect(() => {
    if (!visible) return;

    const frameSequences: Record<
      PaimonAction,
      number[]
    > = {
      idle: [
        0, 1, 2, 3,
        4, 5, 6, 7,
      ],

      'running-right': [
        0, 1,
      ],

      'running-left': [
        6, 7,
      ],

      waving: [
        0, 1, 2, 3,
        4, 5, 6, 7,
      ],

      jumping: [
        0, 1, 2, 3,
        4, 5, 6, 7,
      ],

      failed: [
        0, 1, 2, 3,
        4, 5, 6, 7,
      ],

      waiting: [
        0, 1, 2, 3,
        4, 5, 6, 7,
      ],

      running: [
        0, 1, 2, 3,
        4, 5, 6, 7,
      ],

      review: [
        0, 1, 2, 3,
        4, 5, 6, 7,
      ],
    };

    const sequence =
      frameSequences[action];

    let sequenceIndex = 0;

    setFrame(sequence[0]);

    const frameInterval =
      action === 'waiting'
        ? 220
        : action === 'review'
          ? 180
          : action === 'idle'
            ? 170
            : action ===
              'running-right' ||
              action ===
              'running-left'
              ? 150
              : 125;

    const interval =
      window.setInterval(() => {
        sequenceIndex =
          (sequenceIndex + 1) %
          sequence.length;

        setFrame(
          sequence[sequenceIndex],
        );
      }, frameInterval);

    return () => {
      window.clearInterval(interval);
    };
  }, [action, visible]);

  /*
   * Start AFK timer.
   */
  useEffect(() => {
    if (!visible) return;

    resetAfkTimer();

    return () => {
      clearAfkTimeout();
    };
  }, [visible]);

  /*
   * Normal autonomous behavior.
   */
  useEffect(() => {
    if (!visible) return;
    if (isAfk) return;
    if (presence !== 'visible') return;

    scheduleNextNormalBehavior();

    return () => {
      clearNormalBehaviorTimeout();
    };
  }, [
    visible,
    isAfk,
    presence,
  ]);

  /*
   * Site interactions.
   *
   * Mouse movement and keyboard input
   * do not count.
   */
  useEffect(() => {
    const handleSiteClick = (
      event: MouseEvent,
    ) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest(
          '[data-paimon-companion]',
        )
      ) {
        return;
      }

      reactToSiteInteraction(target);
    };

    const handleSiteScroll = () => {
      if (!visibleRef.current) return;

      resetAfkTimer();
    };

    const handleSiteInput = () => {
      if (!visibleRef.current) return;

      resetAfkTimer();
    };

    document.addEventListener(
      'click',
      handleSiteClick,
      true,
    );

    document.addEventListener(
      'scroll',
      handleSiteScroll,
      true,
    );

    document.addEventListener(
      'input',
      handleSiteInput,
      true,
    );

    document.addEventListener(
      'change',
      handleSiteInput,
      true,
    );

    return () => {
      document.removeEventListener(
        'click',
        handleSiteClick,
        true,
      );

      document.removeEventListener(
        'scroll',
        handleSiteScroll,
        true,
      );

      document.removeEventListener(
        'input',
        handleSiteInput,
        true,
      );

      document.removeEventListener(
        'change',
        handleSiteInput,
        true,
      );
    };
  }, []);

  /*
   * Background movement.
   */
  useEffect(() => {
    if (!visible) return;
    if (presence !== 'visible') return;

    const interval =
      window.setInterval(() => {
        moveToRandomSpot();
      }, 8000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    visible,
    presence,
  ]);

  /*
   * AFK behavior.
   */
  useEffect(() => {
    if (!visible) return;
    if (!isAfk) return;
    if (presence !== 'visible') return;

    const interval =
      window.setInterval(() => {
        if (actionBusyRef.current) {
          return;
        }

        const messages = [
          'Traveler...?',
          'Paimon is getting hungry...',
          'Is there something interesting over there?',
          'Paimon is still waiting.',
          'Should we go exploring?',
          'Hmmmmmm...',
          'Did you fall asleep?',
          'Paimon is getting bored...',
          'Maybe we should go somewhere!',
        ];

        const message =
          messages[
          Math.floor(
            Math.random() *
            messages.length,
          )
          ];

        playTemporaryAction(
          'waiting',
          2200,
          message,
        );

        moveToRandomSpot();
      }, 7000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    isAfk,
    visible,
    presence,
  ]);

  useEffect(() => {
    return () => {
      clearActionTimeout();
      clearMovementTimeout();
      clearAfkTimeout();
      clearNormalBehaviorTimeout();
      clearPresenceTimeouts();
    };
  }, []);

  if (!visible) {
    return null;
  }

  const row =
    spriteRows[action];

  const backgroundX =
    frame * 256;

  const backgroundY =
    row * 256;

  return (
    <div
      className={`paimon-companion paimon-companion--${presence}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
      data-paimon-companion
    >
      <div className="paimon-companion__speech">
        {speech}
      </div>

      <button
        type="button"
        className="paimon-companion__button"
        onClick={handlePaimonClick}
        aria-label="Interact with Paimon"
      >
        <div
          className="paimon-companion__sprite"
          style={{
            backgroundPosition:
              `-${backgroundX}px -${backgroundY}px`,
          }}
        />
      </button>
    </div>
  );
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

    return () =>
      window.clearInterval(
        interval,
      );
  }, [
    slideshowCharacters.length,
  ]);

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
      <PaimonCompanion />

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

          {featured && (
            <div
              style={{
                position:
                  'absolute',
                inset: 0,
                opacity:
                  isTransitioning
                    ? 0
                    : 1,
                transform:
                  isTransitioning
                    ? 'translateY(12px) scale(0.985)'
                    : 'translateY(0) scale(1)',
                transition:
                  'opacity 350ms ease, transform 350ms ease',
              }}
            >
              <AsyncImage
                src={
                  featuredImages
                }
                alt={
                  featured.name
                }
                className="home-hero__character"
                assetKey={assetKey(
                  'characters',
                  featured.id ||
                  featured.name,
                )}
              />

              <div className="home-hero__caption">
                <span>
                  {
                    featured.name
                  }
                </span>

                <small>
                  {`${featured.element ?? 'Unknown'} · ${featured.weapon ?? 'Character'}`}
                </small>
              </div>
            </div>
          )}
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