"use client";

import type { ReactNode } from "react";

export type PriorityTone = "critical" | "warning" | "normal";

type PriorityMetric = {
  label: string;
  value: ReactNode;
  tone?: PriorityTone;
};

type PriorityStatusBarProps = {
  tone: PriorityTone;
  title: string;
  summary: string;
  attention: string;
  action: string;
  actionLabel?: string;
  onAction?: () => void;
  metrics?: PriorityMetric[];
};

type DashboardEmptyStateProps = {
  icon: ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: PriorityTone;
  compact?: boolean;
};

type AiRecommendation = {
  tone?: PriorityTone;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

type AiDecisionCenterProps = {
  title?: string;
  subtitle?: string;
  recommendations: AiRecommendation[];
  emptyTitle: string;
  emptyBody: string;
};

const toneLabels: Record<PriorityTone, string> = {
  critical: "Critical",
  warning: "Warning",
  normal: "Normal",
};

export function PriorityStatusBar({
  tone,
  title,
  summary,
  attention,
  action,
  actionLabel,
  onAction,
  metrics = [],
}: PriorityStatusBarProps) {
  return (
    <section className={`priority-status priority-status--${tone}`} aria-label="Priority status">
      <div className="priority-status__main">
        <div className="priority-status__badge">
          <span className="priority-status__dot" aria-hidden="true" />
          <span>{toneLabels[tone]}</span>
        </div>
        <div>
          <h2>{title}</h2>
          <p>{summary}</p>
        </div>
      </div>

      <div className="priority-status__brief">
        <div>
          <span>Анхаарах</span>
          <strong>{attention}</strong>
        </div>
        <div>
          <span>Дараагийн алхам</span>
          <strong>{action}</strong>
        </div>
      </div>

      {metrics.length ? (
        <div className="priority-status__metrics" aria-label="Priority metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className={`priority-status__metric priority-status__metric--${metric.tone ?? "normal"}`}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {actionLabel && onAction ? (
        <button className="priority-status__action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

export function DashboardEmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  tone = "normal",
  compact = false,
}: DashboardEmptyStateProps) {
  return (
    <div className={`dashboard-empty dashboard-empty--${tone}${compact ? " dashboard-empty--compact" : ""}`}>
      <div className="dashboard-empty__icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <div className="dashboard-empty__title">{title}</div>
        <div className="dashboard-empty__message">{message}</div>
      </div>
      {actionLabel && onAction ? (
        <button className="dashboard-empty__action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function AiDecisionCenter({
  title = "AI Decision Center",
  subtitle = "Зөвлөмжийг нэг дор төвлөрүүлэв",
  recommendations,
  emptyTitle,
  emptyBody,
}: AiDecisionCenterProps) {
  return (
    <section className="ai-decision-center" aria-label={title}>
      <div className="ai-decision-center__head">
        <div>
          <div className="ai-decision-center__eyebrow">Decision support</div>
          <h3>{title}</h3>
        </div>
        <span className="ai-decision-center__chip">AI</span>
      </div>
      <p className="ai-decision-center__subtitle">{subtitle}</p>

      {recommendations.length ? (
        <div className="ai-decision-center__list">
          {recommendations.map((item) => (
            <article key={item.title} className={`ai-decision-card ai-decision-card--${item.tone ?? "normal"}`}>
              <div>
                <div className="ai-decision-card__title">{item.title}</div>
                <p>{item.body}</p>
              </div>
              {item.actionLabel && item.onAction ? (
                <button type="button" onClick={item.onAction}>
                  {item.actionLabel}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <DashboardEmptyState icon="✓" title={emptyTitle} message={emptyBody} tone="normal" compact />
      )}
    </section>
  );
}
