import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createToastTransitionTracker,
  evaluateToastTransition,
  startConnectionMonitor,
  useConnectionMonitor,
  type ConnectionStatus,
  type ToastTransitionTracker,
} from "@/services/connectionMonitor";

const STATUS_DOTS: Record<ConnectionStatus, string> = {
  good: "🟢",
  degraded: "🟡",
  poor: "🔴",
  offline: "⚫",
};

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  good: "Bon",
  degraded: "Dégradé",
  poor: "Mauvais",
  offline: "Hors ligne",
};

function formatLatency(latencyMs: number | null) {
  return latencyMs === null ? "..." : `${latencyMs}ms`;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <div className="h-5 rounded-sm bg-muted" aria-hidden="true" />;
  }

  const max = Math.max(...values, 1);

  return (
    <div className="flex h-5 items-end gap-1" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="w-2 rounded-sm bg-primary"
          style={{ height: `${Math.max(20, Math.round((value / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

export function ConnectionIndicator({ visible }: { visible: boolean }) {
  const connection = useConnectionMonitor();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const trackerRef = useRef<ToastTransitionTracker>(createToastTransitionTracker());

  useEffect(() => {
    startConnectionMonitor();
  }, []);

  useEffect(() => {
    const result = evaluateToastTransition(
      trackerRef.current,
      connection.status,
      visible,
    );
    trackerRef.current = result.tracker;

    if (!result.shouldNotify) return;

    toast.warning("Connexion dégradée — la validation des mots peut être lente", {
      duration: 4000,
      closeButton: true,
    });
  }, [connection.lastChecked, connection.status, visible]);

  const statusDot = STATUS_DOTS[connection.status];
  const statusLabel = STATUS_LABELS[connection.status];
  const compactLabel = useMemo(
    () => `${statusLabel} Lovable AI, ${formatLatency(connection.latencyMs)}`,
    [connection.latencyMs, statusLabel],
  );

  if (!visible) return null;

  return (
    <div
      className="absolute right-3 top-16 z-50 text-sm text-card-foreground sm:right-4 sm:top-4"
      style={{ fontFamily: '"Fredoka One", system-ui, sans-serif' }}
    >
      <button
        type="button"
        aria-label={compactLabel}
        aria-expanded={tooltipOpen}
        onClick={() => setTooltipOpen((open) => !open)}
        onBlur={() => setTooltipOpen(false)}
        className="group relative flex items-center gap-2 rounded-md border border-border bg-card/85 px-3 py-2 shadow-lg backdrop-blur transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={connection.isPinging ? "animate-pulse" : ""} aria-hidden="true">
          {statusDot}
        </span>
        <span className="min-w-12 text-left font-bold tabular-nums">
          {formatLatency(connection.latencyMs)}
        </span>
        <span
          className={[
            "pointer-events-none absolute right-0 top-full mt-2 w-64 rounded-md border border-border bg-popover/95 p-3 text-left text-popover-foreground opacity-0 shadow-lg backdrop-blur transition-opacity",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            tooltipOpen ? "pointer-events-auto opacity-100" : "",
          ].join(" ")}
          role="tooltip"
        >
          <span className="block text-xs font-bold uppercase text-muted-foreground">
            Lovable AI
          </span>
          <span className="mt-1 block text-base font-bold">{statusLabel}</span>
          <span className="mt-2 block text-xs text-muted-foreground">
            Moyenne:{" "}
            <span className="font-bold text-popover-foreground">
              {formatLatency(connection.latencyMs)}
            </span>
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Dernier ping:{" "}
            <span className="font-bold text-popover-foreground">
              {formatLatency(connection.rawLatencyMs)}
            </span>
          </span>
          <span className="mt-3 block">
            <Sparkline values={connection.pingHistory} />
          </span>
        </span>
      </button>
    </div>
  );
}
