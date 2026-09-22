import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { fetchEntity, fetchFolderEntities, fetchStats } from '../api/genshinDb';
import { assetKey, entityImageSources, genshinBuildsMaterialImage } from '../api/genshinDev';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import { extractMaterials, formatValue } from '../utils/genshin';
import type { LibraryEntity } from '../types/genshin';

function weaponRefinementDescriptions(entity: LibraryEntity): Record<string, string> {
  const raw = entity.raw && typeof entity.raw === 'object'
    ? entity.raw as Record<string, unknown>
    : {};

  const refinements: Record<string, string> = {};

  for (const level of ['r1', 'r2', 'r3', 'r4', 'r5']) {
    const value = raw[level];

    if (!value || typeof value !== 'object') continue;

    const record = value as Record<string, unknown>;

    if (typeof record.description === 'string' && record.description.trim()) {
      refinements[level] = record.description.trim();
    }
  }

  return refinements;
}

type WeaponProgressionRow = {
  level: string;
  attack: unknown;
  secondary: unknown;
};

function weaponProgressionRows(value: Record<string, unknown>): WeaponProgressionRow[] {
  const nested = value.stats && typeof value.stats === 'object'
    ? value.stats as Record<string, unknown>
    : value.result && typeof value.result === 'object'
      ? value.result as Record<string, unknown>
      : value;

  const milestones = new Set(['1', '20', '40', '50', '60', '70', '80', '90']);

  const rows = (
    Array.isArray(nested)
      ? nested.map((row) => [
          String((row as Record<string, unknown>).level ?? ''),
          row,
        ] as const)
      : Object.entries(nested)
  )
    .map(([level, row]) => {
      const record =
        row &&
        typeof row === 'object' &&
        !Array.isArray(row)
          ? row as Record<string, unknown>
          : {};

      const displayLevel = String(record.level ?? level).replace(/\+$/, '');

      return {
        level: displayLevel,
        attack:
          record.attack ??
          record.atk ??
          record.baseAttack ??
          record.baseatk ??
          record.baseATK,
        secondary:
          record.specialized ??
          record.specializedStat ??
          record.substat ??
          record.secondary ??
          record.mainStatValue,
      };
    })
    .filter(
      (row) =>
        milestones.has(row.level) &&
        row.attack !== undefined,
    )
    .sort((a, b) => Number(a.level) - Number(b.level));

  return rows.filter(
    (row, index) =>
      index === 0 ||
      row.level !== rows[index - 1].level,
  );
}

function formatWeaponSecondary(
  value: unknown,
  stat?: string,
  example?: string,
): string {
  const numeric =
    typeof value === 'number'
      ? value
      : Number(value);

  if (!Number.isFinite(numeric)) {
    return formatValue(value);
  }

  const isPercentage =
    /(?:crit|energy recharge|healing|dmg|damage|%)/i.test(
      `${stat ?? ''} ${example ?? ''}`,
    );

  if (!isPercentage) {
    return formatValue(numeric);
  }

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(numeric * 100)}%`;
}

function weaponUpgradeMaterials(entity: LibraryEntity) {
  return extractMaterials(entity.raw).filter(
    (material) =>
      material.name.toLowerCase() !== entity.name.toLowerCase(),
  );
}

function MaterialImage({
  name,
  entity,
}: {
  name: string;
  entity?: LibraryEntity;
}) {
  return (
    <AsyncImage
      src={[
        genshinBuildsMaterialImage(name),
        ...(entity ? entityImageSources('materials', entity) : []),
      ]}
      alt=""
      className="material-icon"
      fallback="N/A"
      assetKey={assetKey('materials', name)}
    />
  );
}

export function LibraryPage({
  folder,
  title,
  eyebrow,
  description,
}: {
  folder: string;
  title: string;
  eyebrow: string;
  description: string;
}) {
  const [items, setItems] = useState<LibraryEntity[]>([]);
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('All');
  const [selected, setSelected] = useState<LibraryEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedWeaponRefinementLevel, setSelectedWeaponRefinementLevel] = useState('r1');

  const [weaponProgressions, setWeaponProgressions] = useState<
    Record<string, Record<string, unknown>>
  >({});

  const [weaponProgressionLoading, setWeaponProgressionLoading] = useState(false);

  const [materialEntities, setMaterialEntities] = useState<
    Record<string, LibraryEntity>
  >({});

  // Lock the page behind the drawer while keeping the drawer scrollable.
  useEffect(() => {
    if (!selected) return;

    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, [selected]);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetchFolderEntities(folder, controller.signal)
      .then(setItems)
      .catch((reason) => {
        if (reason?.name !== 'AbortError') {
          setError(
            reason instanceof Error
              ? reason.message
              : `Unable to load ${folder}.`,
          );
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [folder]);

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (!search ||
            `${item.name} ${item.type ?? ''} ${item.description ?? ''}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (rarity === 'All' || String(item.rarity) === rarity),
      ),
    [items, search, rarity],
  );

  async function open(item: LibraryEntity) {
    setSelected(item);

    if (folder === 'weapons') {
      setSelectedWeaponRefinementLevel('r1');

      const key = item.name;
      const existingProgression = weaponProgressions[key];

      if (!existingProgression) {
        setWeaponProgressionLoading(true);

        fetchStats('weapons', key)
          .then((stats) => {
            setWeaponProgressions((current) => ({
              ...current,
              [key]: stats,
            }));
          })
          .catch(() => {
            // Keep the drawer usable if progression data is unavailable.
          })
          .finally(() => {
            setWeaponProgressionLoading(false);
          });
      }

      const refinements = weaponRefinementDescriptions(item);

      if (Object.keys(refinements).length > 0) {
        return;
      }
    } else if (
      item.description ||
      Object.keys(item.raw).length > 3
    ) {
      return;
    }

    try {
      const detail = await fetchEntity(folder, item.name);

      setSelected((current) => {
        if (!current || current.name !== item.name) {
          return current;
        }

        return {
          ...detail,
          icon: item.icon || detail.icon,
          raw: {
            ...detail.raw,
            ...item.raw,
          },
        };
      });
    } catch {
      // Keep the index data when the detailed request is unavailable.
    }
  }

  const selectedWeapon =
    folder === 'weapons' && selected
      ? selected
      : null;

  const selectedWeaponRefinements =
    selectedWeapon
      ? weaponRefinementDescriptions(selectedWeapon)
      : {};

  const selectedWeaponRefinement =
    selectedWeaponRefinements[selectedWeaponRefinementLevel]
    ?? selectedWeaponRefinements.r1
    ?? '';

  const selectedWeaponStats =
    selectedWeapon
      ? weaponProgressions[selectedWeapon.name] ?? {}
      : {};

  const selectedWeaponRows =
    selectedWeapon
      ? weaponProgressionRows(selectedWeaponStats)
      : [];

  // Keep this derived from selectedWeapon, but do not use the array
  // as a useEffect dependency because it is recreated on every render.
  const selectedWeaponMaterials =
    selectedWeapon
      ? weaponUpgradeMaterials(selectedWeapon)
      : [];

  useEffect(() => {
    if (!selectedWeapon) {
      setMaterialEntities({});
      return;
    }

    const controller = new AbortController();

    const materials = weaponUpgradeMaterials(selectedWeapon);

    const names = [
      ...new Set(
        materials.map((material) => material.name),
      ),
    ].slice(0, 50);

    const load = async () => {
      for (let offset = 0; offset < names.length; offset += 6) {
        const batch = await Promise.all(
          names
            .slice(offset, offset + 6)
            .map(async (name) => {
              try {
                return [
                  name,
                  await fetchEntity(
                    'materials',
                    name,
                    controller.signal,
                  ),
                ] as const;
              } catch {
                return null;
              }
            }),
        );

        if (controller.signal.aborted) return;

        const resolved = batch.filter(
          (
            entry,
          ): entry is readonly [string, LibraryEntity] =>
            Boolean(entry),
        );

        if (resolved.length) {
          setMaterialEntities((current) => ({
            ...current,
            ...Object.fromEntries(resolved),
          }));
        }
      }
    };

    void load();

    return () => controller.abort();
  }, [selectedWeapon]);

  return (
    <div>
      <SectionTitle
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      <div className="toolbar">
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${folder}...`}
        />

        <select
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
        >
          <option>All</option>
          <option value="5">5★</option>
          <option value="4">4★</option>
          <option value="3">3★</option>
          <option value="2">2★</option>
          <option value="1">1★</option>
        </select>
      </div>

      <div className="results-bar">
        <span>
          {loading
            ? 'Loading…'
            : `${filtered.length} entries`}
        </span>

        <span className="muted">
          Browse the available library entries
        </span>
      </div>

      {error && (
        <div className="error-box">
          <strong>
            {eyebrow} data could not be loaded.
          </strong>

          <p>{error}</p>

          <p>
            Use Refresh latest data in the sidebar after a provider outage.
          </p>
        </div>
      )}

      {loading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              className="skeleton-card compact"
              key={i}
            />
          ))}
        </div>
      ) : (
        <div className="entity-grid">
          {filtered.map((item) => (
            <button
              className="entity-card"
              key={item.id || item.name}
              onClick={() => open(item)}
            >
              <AsyncImage
                className="entity-icon"
                src={entityImageSources(folder, item)}
                alt={item.name}
                assetKey={assetKey(folder, item.name)}
              />

              <div>
                <strong>{item.name}</strong>

                <span>
                  {item.type ?? '—'}{' '}
                  {item.rarity
                    ? `· ${'★'.repeat(item.rarity)}`
                    : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="drawer-backdrop"
          onMouseDown={() => setSelected(null)}
        >
          <aside
            className="drawer"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="drawer-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <AsyncImage
              src={entityImageSources(folder, selected)}
              alt={selected.name}
              className="drawer-image"
              assetKey={assetKey(folder, selected.name)}
            />

            <div className="eyebrow">
              {selected.type ?? folder}
            </div>

            <h2>{selected.name}</h2>

            {selected.rarity && (
              <div className="gold-stars">
                {'★'.repeat(selected.rarity)}
              </div>
            )}

            {(selected.baseAttack ||
              selected.secondaryStat ||
              selected.secondaryValue) && (
              <div className="build-stat-grid">
                <div>
                  <span>Base ATK (Lv. 1)</span>
                  <strong>
                    {selected.baseAttack ?? 'N/A'}
                  </strong>
                </div>

                <div>
                  <span>Secondary stat</span>
                  <strong>
                    {selected.secondaryStat ?? 'N/A'}
                  </strong>
                </div>

                <div>
                  <span>Value</span>
                  <strong>
                    {selected.secondaryValue ?? 'N/A'}
                  </strong>
                </div>
              </div>
            )}

            {folder === 'weapons' ? (
              <>
                {selected.effectName && (
                  <h3>{selected.effectName}</h3>
                )}

                {Object.keys(selectedWeaponRefinements).length > 0 && (
                  <div className="tabs weapon-refinement-tabs">
                    {['r1', 'r2', 'r3', 'r4', 'r5']
                      .filter(
                        (level) =>
                          selectedWeaponRefinements[level],
                      )
                      .map((level) => (
                        <button
                          key={level}
                          className={
                            selectedWeaponRefinementLevel === level
                              ? 'tab active'
                              : 'tab'
                          }
                          onClick={() =>
                            setSelectedWeaponRefinementLevel(level)
                          }
                        >
                          {level.toUpperCase()}
                        </button>
                      ))}
                  </div>
                )}

                <p>
                  {selectedWeaponRefinement ||
                    'The weapon passive description is not exposed by the current data source.'}
                </p>

                {selected.description && (
                  <div className="drawer-section">
                    <div className="eyebrow">
                      DESCRIPTION
                    </div>

                    <p>{selected.description}</p>
                  </div>
                )}

                <div className="drawer-section">
                  <div className="eyebrow">
                    PROGRESSION
                  </div>

                  <h3>Weapon stats by level</h3>

                  {selectedWeaponRows.length ? (
                    <div className="stat-table-wrap">
                      <table className="stat-table">
                        <thead>
                          <tr>
                            <th>Level</th>
                            <th>Base ATK</th>
                            <th>
                              {selected.secondaryStat ??
                                'Secondary stat'}
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {selectedWeaponRows.map((row) => (
                            <tr key={row.level}>
                              <td>{row.level}</td>

                              <td>
                                {formatValue(row.attack)}
                              </td>

                              <td>
                                {formatWeaponSecondary(
                                  row.secondary,
                                  selected.secondaryStat,
                                  selected.secondaryValue,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">
                      {weaponProgressionLoading
                        ? 'Loading weapon progression…'
                        : 'Level-by-level stats are not available from the current source.'}
                    </p>
                  )}
                </div>

                <div className="drawer-section">
                  <div className="eyebrow">
                    ASCENSION
                  </div>

                  <h3>Upgrade materials</h3>

                  {selectedWeaponMaterials.length ? (
                    <div className="material-table weapon-material-table">
                      {selectedWeaponMaterials.map(
                        (material) => (
                          <div
                            className="material-row player-material-row"
                            key={material.name}
                          >
                            <MaterialImage
                              name={material.name}
                              entity={
                                materialEntities[material.name]
                              }
                            />

                            <span>
                              <strong>
                                {material.name}
                              </strong>

                              {material.category && (
                                <small>
                                  {material.category}
                                </small>
                              )}
                            </span>

                            <strong>
                              {material.amount ?? '—'}
                            </strong>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="muted">
                      Upgrade requirements are not available from the current source.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                {selected.effectName && (
                  <h3>{selected.effectName}</h3>
                )}

                {selected.twoPieceBonus && (
                  <p>
                    <strong>2-piece:</strong>{' '}
                    {selected.twoPieceBonus}
                  </p>
                )}

                {selected.fourPieceBonus && (
                  <p>
                    <strong>4-piece:</strong>{' '}
                    {selected.fourPieceBonus}
                  </p>
                )}

                {!selected.twoPieceBonus &&
                  !selected.fourPieceBonus && (
                    <p>
                      {selected.description ??
                        'No additional information was returned.'}
                    </p>
                  )}
              </>
            )}

            <a
              className="source-button"
              href="https://genshin-db-api.vercel.app/"
              target="_blank"
              rel="noreferrer"
            >
              View data source
              <ExternalLink size={13} />
            </a>
          </aside>
        </div>
      )}
    </div>
  );
}