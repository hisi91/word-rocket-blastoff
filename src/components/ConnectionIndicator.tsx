import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ConnectionStatus = "good" | "degraded" | "poor" | "offline";

interface ConnectionState {
  latencyMs: number | null;
  rawLatencyMs: number | null;
  status: ConnectionStatus;
  lastChecked: Date | null;
  pingHistory: number[];
}

const PING_INTERVAL_MS = 5000;
const PING_TIMEOUT_MS = 4500;

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

function getStatus(latencyMs: number | null): ConnectionStatus {
  if (latencyMs === null) return "offline";
  if (latencyMs < 1000) return "good";
  if (latencyMs < 3000) return "degraded";
  return "poor";
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
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
  const [connection, setConnection] = useState<ConnectionState>({
    latencyMs: null,
    rawLatencyMs: null,
    status: "offline",
    lastChecked: null,
    pingHistory: [],
  });
  const [isPinging, setIsPinging] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const warningRef = useRef({
    status: null as ConnectionStatus | null,
    count: 0,
    lastNotified: null as ConnectionStatus | null,
  });

  useEffect(() => {
    if (!visible) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let activeController: AbortController | null = null;

    const stop = () => {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = null;
      activeController?.abort();
      activeController = null;
      setIsPinging(false);
    };

    const ping = async () => {
      if (document.hidden || activeController) return;

      const controller = new AbortController();
      activeController = controller;
      setIsPinging(true);
      const timeoutId = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      const startedAt = performance.now();

      try {
        const response = await fetch("/api/ping-ai", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`ping-ai ${response.status}`);

        const rawLatencyMs = Math.max(0, Math.round(performance.now() - startedAt));
        setConnection((current) => {
          const pingHistory = [...current.pingHistory, rawLatencyMs].slice(-3);
          const latencyMs = average(pingHistory);

          return {
            latencyMs,
            rawLatencyMs,
            status: getStatus(latencyMs),
            lastChecked: new Date(),
            pingHistory,
          };
        });
      } catch {
        setConnection((current) => ({
          ...current,
          latencyMs: null,
          rawLatencyMs: null,
          status: "offline",
          lastChecked: new Date(),
        }));
      } finally {
        window.clearTimeout(timeoutId);
        activeController = null;
        setIsPinging(false);
      }
    };

    const start = () => {
      if (intervalId || document.hidden) return;
      void ping();
      intervalId = window.setInterval(() => {
        void ping();
      }, PING_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
        return;
      }
      start();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    start();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stop();
    };
  }, [visible]);

  useEffect(() => {
    const problemStatus = visible && (connection.status === "poor" || connection.status === "offline");

    if (!problemStatus) {
      warningRef.current = { status: null, count: 0, lastNotified: null };
      return;
    }

    const warning = warningRef.current;
    const count = warning.status === connection.status ? warning.count + 1 : 1;
    const shouldNotify = count >= 2 && warning.lastNotified !== connection.status;

    warningRef.current = {
      status: connection.status,
      count,
      lastNotified: shouldNotify ? connection.status : warning.lastNotified,
    };

    if (shouldNotify) {
      toast.warning("Connexion dégradée — la validation des mots peut être lente", {
        duration: 4000,
        closeButton: true,
      });
    }
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
        <span className={isPinging ? "animate-pulse" : ""} aria-hidden="true">
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
