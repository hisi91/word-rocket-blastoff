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

const STATUS_ICONS: Record<ConnectionStatus, string> = {
  good: "/assets/latency-good.webp",
  degraded: "/assets/latency-medium.webp",
  poor: "/assets/latency-bad.png",
  offline: "/assets/latency-off.webp",
};

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  good: "Bon",
  degraded: "Dégradé",
  poor: "Mauvais",
  offline: "Hors ligne",
};

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
        const response = await fetch("/api/ping-groq", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`ping-groq ${response.status}`);

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

  const statusIcon = STATUS_ICONS[connection.status];
  const statusLabel = STATUS_LABELS[connection.status];
  const compactLabel = useMemo(
    () => `${statusLabel} Groq API`,
    [statusLabel],
  );

  if (!visible) return null;

  return (
    <div className="absolute left-2 top-[214px] z-50 text-sm text-card-foreground">
      <button
        type="button"
        aria-label={compactLabel}
        aria-expanded={tooltipOpen}
        onClick={() => setTooltipOpen((open) => !open)}
        onBlur={() => setTooltipOpen(false)}
        className="group relative flex h-12 w-12 items-center justify-center rounded-md border-0 bg-transparent p-0 shadow-none transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={statusIcon}
          alt=""
          aria-hidden="true"
          className={[
            "h-12 w-12 rounded-md object-contain drop-shadow-lg",
            isPinging ? "animate-pulse" : "",
          ].join(" ")}
        />
        <span
          className={[
            "pointer-events-none absolute left-full top-0 ml-2 w-56 rounded-md border border-border bg-popover/95 p-3 text-left text-popover-foreground opacity-0 shadow-lg backdrop-blur transition-opacity",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            tooltipOpen ? "pointer-events-auto opacity-100" : "",
          ].join(" ")}
          role="tooltip"
        >
          <span className="block text-xs font-bold uppercase text-muted-foreground">
            Groq API
          </span>
          <span className="mt-1 block text-base font-bold">{statusLabel}</span>
          <span className="mt-2 block text-xs text-muted-foreground">
            Qualité de connexion pour la validation vocale.
          </span>
        </span>
      </button>
    </div>
  );
}
