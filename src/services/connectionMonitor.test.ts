import assert from "node:assert/strict";
import test from "node:test";

import {
  addPingToHistory,
  applyFailedPing,
  applySuccessfulPing,
  calculateRollingAverage,
  createToastTransitionTracker,
  evaluateToastTransition,
  measureConnectionPing,
  statusFromLatency,
  type ConnectionState,
} from "./connectionMonitor";

const emptyState: ConnectionState = {
  latencyMs: null,
  rawLatencyMs: null,
  status: "offline",
  lastChecked: null,
  pingHistory: [],
};

test("rolling average handles fewer than three pings", () => {
  const history = addPingToHistory([], 600);

  assert.deepEqual(history, [600]);
  assert.equal(calculateRollingAverage(history), 600);
});

test("rolling average handles exactly three pings", () => {
  const history = [300, 600, 900];

  assert.equal(calculateRollingAverage(history), 600);
});

test("rolling average rotates FIFO after three pings", () => {
  const history = addPingToHistory([300, 600, 900], 1200);

  assert.deepEqual(history, [600, 900, 1200]);
  assert.equal(calculateRollingAverage(history), 900);
});

test("latency tiers map boundary values", () => {
  assert.equal(statusFromLatency(999), "good");
  assert.equal(statusFromLatency(1000), "degraded");
  assert.equal(statusFromLatency(2999), "degraded");
  assert.equal(statusFromLatency(3000), "poor");
});

test("normal ping updates state from fetch response", async () => {
  let nowValue = 100;
  const fetchImpl = async () => {
    nowValue += 612;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const rawLatencyMs = await measureConnectionPing(fetchImpl, () => nowValue);
  const state = applySuccessfulPing(
    emptyState,
    rawLatencyMs,
    new Date("2026-06-10T10:00:00Z"),
  );

  assert.equal(rawLatencyMs, 612);
  assert.equal(state.latencyMs, 612);
  assert.equal(state.rawLatencyMs, 612);
  assert.equal(state.status, "good");
  assert.deepEqual(state.pingHistory, [612]);
});

test("slow ping maps to poor through rolling average", async () => {
  let nowValue = 100;
  const fetchImpl = async () => {
    nowValue += 4000;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const rawLatencyMs = await measureConnectionPing(fetchImpl, () => nowValue, 5000);
  const state = applySuccessfulPing(emptyState, rawLatencyMs);

  assert.equal(rawLatencyMs, 4000);
  assert.equal(state.status, "poor");
});

test("network timeout maps to offline", async () => {
  const fetchImpl = async () => {
    throw new DOMException("The operation was aborted.", "AbortError");
  };

  await assert.rejects(() => measureConnectionPing(fetchImpl));

  const state = applyFailedPing(emptyState);
  assert.equal(state.status, "offline");
  assert.equal(state.latencyMs, null);
  assert.equal(state.rawLatencyMs, null);
});

test("offline fetch maps to offline", async () => {
  const fetchImpl = async () => {
    throw new TypeError("Failed to fetch");
  };

  await assert.rejects(() => measureConnectionPing(fetchImpl));

  const state = applyFailedPing(emptyState);
  assert.equal(state.status, "offline");
});

test("toast anti-flicker waits for two consecutive poor/offline states", () => {
  let tracker = createToastTransitionTracker();

  let result = evaluateToastTransition(tracker, "poor", true);
  assert.equal(result.shouldNotify, false);
  tracker = result.tracker;

  result = evaluateToastTransition(tracker, "good", true);
  assert.equal(result.shouldNotify, false);
  tracker = result.tracker;

  result = evaluateToastTransition(tracker, "poor", true);
  assert.equal(result.shouldNotify, false);
  tracker = result.tracker;

  result = evaluateToastTransition(tracker, "poor", true);
  assert.equal(result.shouldNotify, true);
});

test("toast anti-flicker does not retrigger without a status change", () => {
  let tracker = createToastTransitionTracker();

  let result = evaluateToastTransition(tracker, "offline", true);
  tracker = result.tracker;
  result = evaluateToastTransition(tracker, "offline", true);

  assert.equal(result.shouldNotify, true);
  tracker = result.tracker;

  result = evaluateToastTransition(tracker, "offline", true);
  assert.equal(result.shouldNotify, false);
});
