"use client";

import Image from "next/image";

export type BranchModalBranch = {
  id: number;
  name: string;
  category: string;
  capacity: string;
  image: string;
  description: string;
  x?: number;
  y?: number;
  stats: Array<{
    label: string;
    value: string;
  }>;
  bullets: string[];
};

type BranchModalProps = {
  branch: BranchModalBranch | null;
  isVisible: boolean;
  isTouchFallback?: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

function getStatIconClass(label: string) {
  if (label.includes("Ангилал")) return "branch-detail-stat__icon--category";
  if (label.includes("Багтаамж")) return "branch-detail-stat__icon--capacity";
  return "branch-detail-stat__icon--status";
}

export function BranchModal({
  branch,
  isVisible,
  isTouchFallback = false,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: BranchModalProps) {
  const visibleBullets = branch?.bullets.slice(0, 2) ?? [];

  const overlayClassName = [
    "branch-detail-overlay",
    isVisible && branch ? "branch-detail-overlay--open" : "",
    isTouchFallback ? "branch-detail-overlay--touch" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={overlayClassName} aria-hidden={!branch || !isVisible}>
      <div
        className="branch-detail-frame branch-detail-frame--overlay"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="branch-detail-frame__glow" aria-hidden="true" />

        {branch ? (
          <article
            className="branch-detail-card branch-detail-card--modal branch-detail-card--overlay"
            role="region"
            aria-labelledby={`branch-modal-title-${branch.id}`}
          >
            <button
              type="button"
              className="branch-detail-card__close"
              aria-label={`${branch.name} цонхыг хаах`}
              onClick={onClose}
            >
              &#10005;
            </button>

            <div className="branch-detail-card__media">
              <Image
                src={branch.image}
                alt={branch.name}
                width={1200}
                height={720}
                className="branch-detail-card__image"
              />
              <div className="branch-detail-card__media-overlay" />
            </div>

            <div className="branch-detail-card__content">
              <div className="branch-detail-card__compact-head">
                <div className="branch-detail-card__compact-meta">
                  <span className="branch-detail-card__live-badge">
                    <span className="branch-detail-card__live-dot" aria-hidden="true" />
                    Шууд KPI
                  </span>
                  <span className="branch-detail-card__status-chip">{branch.category}</span>
                </div>

                <div className="branch-detail-card__title-wrap">
                  <h3 id={`branch-modal-title-${branch.id}`}>{branch.name}</h3>
                  <p className="branch-detail-card__subtitle">{branch.capacity}</p>
                </div>
              </div>

              <div className="branch-detail-card__section">
                <div className="branch-detail-card__section-head">
                  <span className="branch-detail-card__section-label">Үзүүлэлт</span>
                </div>

                <div className="branch-detail-card__stats">
                  {branch.stats.map((stat) => (
                    <article key={`${branch.id}-${stat.label}`} className="branch-detail-stat">
                      <span className={`branch-detail-stat__icon ${getStatIconClass(stat.label)}`} aria-hidden="true" />
                      <div className="branch-detail-stat__copy">
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="branch-detail-card__section">
                <div className="branch-detail-card__section-head">
                  <span className="branch-detail-card__section-label">Товч мэдээлэл</span>
                </div>

                <ul className="branch-detail-card__list">
                  {visibleBullets.map((bullet, index) => (
                    <li key={`${branch.id}-${bullet}`}>
                      <span className="branch-detail-card__feature-index" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="branch-detail-card__feature-dot" aria-hidden="true" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="branch-detail-card__summary branch-detail-card__summary--compact">{branch.description}</p>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
