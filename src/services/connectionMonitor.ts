import { useSyncExternalStore } from "react";

export type ConnectionStatus = "good" | "degraded" | "poor" | "offline";

export interface ConnectionState {
  latencyMs: number | null;
  rawLatencyMs: number | null;
  status: ConnectionStatus;
  lastChecked: Date | null;
  pingHistory: number[];
}

export interface ConnectionMonitorState extends ConnectionState {
  isPinging: boolean;
}

export interface ToastTransitionTracker {
  candidateStatus: ConnectionStatus | null;
  consecutiveCount: number;
  lastNotifiedStatus: ConnectionStatus | null;
}

const PING_INTERVAL_MS = 5000;
const PING_TIMEOUT_MS = 4500;
const PING_ENDPOINT = "/api/ping-ai";

const initialState: ConnectionMonitorState = {
  latencyMs: null,
  rawLatencyMs: null,
  status: "offline",
  lastChecked: null,
  pingHistory: [],
  isPinging: false,
};

let state = initialState;
let intervalId: ReturnType<typeof setInterval> | null = null;
let inFlight: AbortController | null = null;
let visibilityListenerInstalled = false;

const listeners = new Set<() => void>();

function emit(nextState: ConnectionMonitorState) {
  state = nextState;
  listeners.forEach((listener) => listener());
}

export function addPingToHistory(history: number[], latencyMs: number) {
  return [...history, latencyMs].slice(-3);
}

export function calculateRollingAverage(history: number[]) {
  if (history.length === 0) return null;
  const total = history.reduce((sum, latency) => sum + latency, 0);
  return Math.round(total / history.length);
}

export function statusFromLatency(latencyMs: number | null): ConnectionStatus {
  if (latencyMs === null) return "offline";
  if (latencyMs < 1000) return "good";
  if (latencyMs < 3000) return "degraded";
  return "poor";
}

export function applySuccessfulPing(
  currentState: ConnectionState,
  rawLatencyMs: number,
  checkedAt = new Date(),
): ConnectionState {
  const normalizedLatency = Math.max(0, Math.round(rawLatencyMs));
  const pingHistory = addPingToHistory(currentState.pingHistory, normalizedLatency);
  const latencyMs = calculateRollingAverage(pingHistory);

  return {
    latencyMs,
    rawLatencyMs: normalizedLatency,
    status: statusFromLatency(latencyMs),
    lastChecked: checkedAt,
    pingHistory,
  };
}

export function applyFailedPing(
  currentState: ConnectionState,
  checkedAt = new Date(),
): ConnectionState {
  return {
    ...currentState,
    latencyMs: null,
    rawLatencyMs: null,
    status: "offline",
    lastChecked: checkedAt,
  };
}

export function createToastTransitionTracker(): ToastTransitionTracker {
  return {
    candidateStatus: null,
    consecutiveCount: 0,
    lastNotifiedStatus: null,
  };
}

export function evaluateToastTransition(
  tracker: ToastTransitionTracker,
  status: ConnectionStatus,
  active: boolean,
): { tracker: ToastTransitionTracker; shouldNotify: boolean } {
  const shouldTrackStatus = active && (status === "poor" || status === "offline");

  if (!shouldTrackStatus) {
    return {
      tracker: {
        candidateStatus: null,
        consecutiveCount: 0,
        lastNotifiedStatus: null,
      },
      shouldNotify: false,
    };
  }

  const consecutiveCount =
    tracker.candidateStatus === status ? tracker.consecutiveCount + 1 : 1;
  const nextTracker = {
    candidateStatus: status,
    consecutiveCount,
    lastNotifiedStatus: tracker.lastNotifiedStatus,
  };
  const shouldNotify = consecutiveCount >= 2 && tracker.lastNotifiedStatus !== status;

  return {
    tracker: {
      ...nextTracker,
      lastNotifiedStatus: shouldNotify ? status : tracker.lastNotifiedStatus,
    },
    shouldNotify,
  };
}

export async function measureConnectionPing(
  fetchImpl: typeof fetch = fetch,
  now: () => number = () => performance.now(),
  timeoutMs = PING_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<number> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = now();
  const abort = () => controller.abort();

  try {
    externalSignal?.addEventListener("abort", abort, { once: true });
    const response = await fetchImpl(PING_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`ping-ai ${response.status}`);
    }

    return Math.round(now() - startedAt);
  } finally {
    externalSignal?.removeEventListener("abort", abort);
    clearTimeout(timeoutId);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConnectionSnapshot() {
  return state;
}

export function useConnectionMonitor() {
  return useSyncExternalStore(subscribe, getConnectionSnapshot, getConnectionSnapshot);
}

async function pingOnce() {
  if (inFlight || (typeof document !== "undefined" && document.hidden)) return;

  inFlight = new AbortController();
  emit({ ...state, isPinging: true });

  try {
    const rawLatencyMs = await measureConnectionPing(
      fetch,
      () => performance.now(),
      PING_TIMEOUT_MS,
      inFlight.signal,
    );
    const nextState = applySuccessfulPing(state, rawLatencyMs);
    emit({ ...nextState, isPinging: false });
  } catch {
    const nextState = applyFailedPing(state);
    emit({ ...nextState, isPinging: false });
  } finally {
    inFlight = null;
  }
}

function startInterval() {
  if (intervalId !== null || (typeof document !== "undefined" && document.hidden)) return;
  void pingOnce();
  intervalId = setInterval(() => {
    void pingOnce();
  }, PING_INTERVAL_MS);
}

function stopInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function installVisibilityListener() {
  if (visibilityListenerInstalled || typeof document === "undefined") return;
  visibilityListenerInstalled = true;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopInterval();
      inFlight?.abort();
      inFlight = null;
      emit({ ...state, isPinging: false });
      return;
    }

    startInterval();
  });
}

export function startConnectionMonitor() {
  if (typeof window === "undefined") return;
  installVisibilityListener();
  startInterval();
}

export function stopConnectionMonitor() {
  stopInterval();
  inFlight?.abort();
  inFlight = null;
  emit({ ...state, isPinging: false });
}
