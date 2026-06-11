// src/collector.ts
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import {
  test as base
} from "@playwright/test";

// src/otel.ts
function extractAttributes(detail) {
  if (typeof detail === "object" && detail !== null && "attributes" in detail) {
    const a = detail.attributes;
    if (typeof a === "object" && a !== null) {
      return { ...a };
    }
  }
  return {};
}
function toOtelSpans(measures, timeOrigin) {
  const spans = measures.map((m, i) => ({
    name: m.name,
    spanId: `s${i}`,
    startUnixMs: timeOrigin + m.startTime,
    endUnixMs: timeOrigin + m.startTime + m.duration,
    durationMs: m.duration,
    attributes: extractAttributes(m.detail)
  }));
  for (const child of spans) {
    let best;
    for (const cand of spans) {
      if (cand === child) continue;
      const contains = cand.startUnixMs <= child.startUnixMs && cand.endUnixMs >= child.endUnixMs;
      const strictlyLarger = cand.endUnixMs - cand.startUnixMs > child.endUnixMs - child.startUnixMs;
      if (contains && strictlyLarger) {
        if (!best || cand.endUnixMs - cand.startUnixMs < best.endUnixMs - best.startUnixMs) {
          best = cand;
        }
      }
    }
    if (best) child.parentSpanId = best.spanId;
  }
  return spans;
}
if (import.meta.vitest) {
  const { describe, it, expect: expect2 } = import.meta.vitest;
  describe("toOtelSpans", () => {
    it("shifts startTime to epoch ms by adding timeOrigin", () => {
      const out = toOtelSpans(
        [{ name: "a", startTime: 100, duration: 50 }],
        1e6
      );
      expect2(out[0].startUnixMs).toBe(1000100);
      expect2(out[0].endUnixMs).toBe(1000150);
      expect2(out[0].durationMs).toBe(50);
    });
    it("extracts detail.attributes into span attributes", () => {
      const out = toOtelSpans(
        [
          {
            name: "fetch",
            startTime: 0,
            duration: 10,
            detail: { attributes: { url: "/stats", count: 3, cached: false } }
          }
        ],
        0
      );
      expect2(out[0].attributes).toEqual({
        url: "/stats",
        count: 3,
        cached: false
      });
    });
    it("leaves attributes empty when detail is absent", () => {
      const out = toOtelSpans([{ name: "a", startTime: 0, duration: 1 }], 0);
      expect2(out[0].attributes).toEqual({});
    });
    it("infers the smallest containing span as parent", () => {
      const out = toOtelSpans(
        [
          { name: "outer", startTime: 0, duration: 100 },
          { name: "mid", startTime: 10, duration: 80 },
          { name: "leaf", startTime: 20, duration: 10 }
        ],
        0
      );
      const byName = Object.fromEntries(out.map((s) => [s.name, s]));
      expect2(byName.outer.parentSpanId).toBeUndefined();
      expect2(byName.mid.parentSpanId).toBe(byName.outer.spanId);
      expect2(byName.leaf.parentSpanId).toBe(byName.mid.spanId);
    });
    it("does not assign a parent to non-overlapping siblings", () => {
      const out = toOtelSpans(
        [
          { name: "x", startTime: 0, duration: 10 },
          { name: "y", startTime: 20, duration: 10 }
        ],
        0
      );
      expect2(out[0].parentSpanId).toBeUndefined();
      expect2(out[1].parentSpanId).toBeUndefined();
    });
  });
}

// src/collector.ts
import { expect } from "@playwright/test";
var require2 = createRequire(import.meta.url);
var WEB_VITALS_IIFE = fs.readFileSync(
  path.join(
    path.dirname(require2.resolve("web-vitals")),
    "web-vitals.attribution.iife.js"
  ),
  "utf8"
) + "\n;globalThis.webVitals=webVitals;";
var PERF_OUT_DIR = path.resolve(process.env.PERF_OUT_DIR ?? "perf-results");
var TRACE_ENABLED = process.env.PERF_TRACE === "1";
var CPU_RATE = Number(process.env.PERF_CPU ?? "1");
var SETTLE_TIMEOUT_MS = Number(process.env.PERF_SETTLE_TIMEOUT ?? "5000");
var NET_PROFILES = {
  "slow-3g": { latency: 400, downloadThroughput: 51200, uploadThroughput: 51200 },
  "fast-3g": { latency: 150, downloadThroughput: 196608, uploadThroughput: 98304 },
  "4g": { latency: 40, downloadThroughput: 1179648, uploadThroughput: 589824 }
};
var NET_PROFILE = NET_PROFILES[process.env.PERF_NET ?? ""];
var BUDGET_METRIC = {
  durationMs: (s) => s.durationMs,
  scriptMs: (s) => s.render.scriptMs,
  blockingMs: (s) => s.cpu.blockingMs,
  encodedKB: (s) => s.network.encodedKB,
  requestCount: (s) => s.network.requestCount,
  waves: (s) => s.network.waves,
  busyMs: (s) => s.network.busyMs,
  layoutCount: (s) => s.render.layoutCount,
  nodes: (s) => s.render.nodes,
  thirdPartyKB: (s) => s.network.thirdParty.encodedKB,
  thirdPartyRequestCount: (s) => s.network.thirdParty.requestCount,
  paintMs: (s) => s.render.paintMs ?? 0,
  paintCount: (s) => s.render.paintCount ?? 0
};
function checkBudgets(report) {
  const out = [];
  for (const s of report.spans) {
    if (!s.budget) continue;
    for (const k of Object.keys(s.budget)) {
      const limit = s.budget[k];
      if (limit == null) continue;
      const actual = BUDGET_METRIC[k](s);
      if (actual > limit) {
        out.push(`${s.name}.${k}=${actual} > budget ${limit}`);
      }
    }
  }
  if (report.vitalsBudget) {
    for (const k of Object.keys(report.vitalsBudget)) {
      const limit = report.vitalsBudget[k];
      const actual = report.vitals[k]?.value;
      if (limit != null && actual != null && actual > limit) {
        out.push(`vitals.${k}=${actual} > budget ${limit}`);
      }
    }
  }
  return out;
}
var defaultSettle = (page) => page.evaluate(
  () => new Promise(
    (resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
);
function browserCollector() {
  const w = window;
  w.__perf = { vitals: {}, longTasks: [], loaf: [], measures: [] };
  const store = w.__perf;
  const record = (m) => {
    store.vitals[m.name] = m;
  };
  const wv = w.webVitals;
  if (wv) {
    wv.onLCP(record, { reportAllChanges: true });
    wv.onCLS(record, { reportAllChanges: true });
    wv.onINP(record, { reportAllChanges: true });
    wv.onTTFB(record);
    wv.onFCP(record);
  }
  const drainLongTask = (entries) => {
    for (const e of entries)
      store.longTasks.push({ start: e.startTime, duration: e.duration });
  };
  const drainLoaf = (entries) => {
    for (const e of entries) {
      const loaf = e;
      store.loaf.push({
        start: loaf.startTime,
        duration: loaf.duration,
        blocking: loaf.blockingDuration ?? 0
      });
    }
  };
  const drainMeasure = (entries) => {
    for (const e of entries) {
      const measure = e;
      const detail = measure.detail;
      if (!detail || typeof detail !== "object" || detail.__lbSpan !== true) {
        continue;
      }
      store.measures.push({
        name: measure.name,
        start: measure.startTime,
        duration: measure.duration,
        detail
      });
    }
  };
  const observers = [];
  const observe = (drain, init) => {
    try {
      const obs = new PerformanceObserver((list) => drain(list.getEntries()));
      obs.observe(init);
      observers.push(obs);
    } catch {
    }
  };
  observe(drainLongTask, { type: "longtask", buffered: true });
  observe(drainLoaf, {
    type: "long-animation-frame",
    buffered: true
  });
  observe(drainMeasure, { type: "measure", buffered: true });
  store.flush = () => {
    for (const obs of observers) {
      const records = obs.takeRecords();
      if (records.length === 0) continue;
      const type = records[0].entryType;
      if (type === "longtask") drainLongTask(records);
      else if (type === "long-animation-frame") drainLoaf(records);
      else if (type === "measure") drainMeasure(records);
    }
  };
}
function diffMetrics(before, after) {
  const d = (k) => (after[k] ?? 0) - (before[k] ?? 0);
  return {
    recalcStyleCount: d("RecalcStyleCount"),
    recalcStyleMs: round(d("RecalcStyleDuration") * 1e3),
    layoutCount: d("LayoutCount"),
    layoutMs: round(d("LayoutDuration") * 1e3),
    nodes: d("Nodes"),
    scriptMs: round(d("ScriptDuration") * 1e3)
  };
}
var PerfController = class {
  constructor(page, client, settle = defaultSettle) {
    this.page = page;
    this.client = client;
    this.settle = settle;
  }
  page;
  client;
  settle;
  spans = [];
  vitalsBudget = {};
  /** Declare upper bounds on web-vitals (LCP / INP / CLS / TTFB / FCP) for this test. */
  setVitalsBudget(budget) {
    this.vitalsBudget = budget;
  }
  /**
   * Measure a named operation. Runs action, waits for the page to settle, and
   * records the region as one span. Include your waitFor assertions inside
   * action so the span covers "until the operation is done", then its
   * network / CPU / render breakdown can be correlated afterwards.
   */
  async measure(name, action, opts = {}) {
    const startEpochMs = await this.now();
    const before = await this.metrics();
    await action();
    const capped = await this.runSettle(opts.settle ?? this.settle);
    const endEpochMs = await this.now();
    const after = await this.metrics();
    this.spans.push({
      name,
      startEpochMs,
      endEpochMs,
      capped,
      render: diffMetrics(before, after),
      // getMetrics Timestamp (monotonic seconds) shares the clock with trace ts (μs).
      traceStartUs: (before.Timestamp ?? 0) * 1e6,
      traceEndUs: (after.Timestamp ?? 0) * 1e6,
      budget: opts.budget
    });
  }
  /** Run settle but give up after SETTLE_TIMEOUT_MS. Returns true if it capped. */
  async runSettle(settle) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(true), SETTLE_TIMEOUT_MS);
    });
    const done = settle(this.page).then(() => false);
    const capped = await Promise.race([done, timeout]);
    if (timer) clearTimeout(timer);
    return capped;
  }
  now() {
    return this.page.evaluate(() => performance.timeOrigin + performance.now());
  }
  async metrics() {
    const res = await this.client.send("Performance.getMetrics");
    const out = {};
    for (const m of res.metrics) out[m.name] = m.value;
    return out;
  }
};
async function startNetworkCapture(client) {
  const reqs = /* @__PURE__ */ new Map();
  await client.send("Network.enable");
  client.on("Network.requestWillBeSent", (e) => {
    const p = e;
    reqs.set(p.requestId, {
      url: p.request.url,
      type: p.type ?? "Other",
      startMono: p.timestamp,
      startEpochMs: p.wallTime * 1e3
    });
  });
  client.on("Network.responseReceived", (e) => {
    const p = e;
    const r = reqs.get(p.requestId);
    if (r && p.type) r.type = p.type;
  });
  client.on("Network.loadingFinished", (e) => {
    const p = e;
    const r = reqs.get(p.requestId);
    if (r) {
      r.endEpochMs = r.startEpochMs + (p.timestamp - r.startMono) * 1e3;
      r.encoded = p.encodedDataLength;
    }
  });
  return () => [...reqs.values()];
}
async function startTrace(client) {
  const events = [];
  client.on("Tracing.dataCollected", (e) => {
    const p = e;
    events.push(...p.value);
  });
  await client.send("Tracing.start", {
    transferMode: "ReportEvents",
    categories: [
      "devtools.timeline",
      "disabled-by-default-devtools.timeline",
      "disabled-by-default-devtools.timeline.frame",
      "blink.user_timing",
      "loading",
      "latencyInfo",
      "v8.execute",
      "gpu",
      "disabled-by-default-v8.cpu_profiler"
    ].join(",")
  });
  return async () => {
    const done = new Promise((resolve) => {
      client.once("Tracing.tracingComplete", () => resolve());
    });
    await client.send("Tracing.end");
    await done;
    return events;
  };
}
function round(n) {
  return Math.round(n * 10) / 10;
}
var MULTI_PART_SUFFIXES = /* @__PURE__ */ new Set([
  "co.uk",
  "gov.uk",
  "ac.uk",
  "org.uk",
  "co.jp",
  "ne.jp",
  "or.jp",
  "go.jp",
  "ac.jp",
  "co.kr",
  "co.in",
  "co.nz",
  "co.za",
  "com.au",
  "com.br",
  "com.cn",
  "com.tw",
  "com.hk",
  "com.sg",
  "com.mx"
]);
function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
function registrableDomain(host) {
  if (host.includes(":")) return host;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join(".");
  return MULTI_PART_SUFFIXES.has(last2) ? parts.slice(-3).join(".") : last2;
}
function isThirdParty(reqUrl, firstPartyDomain) {
  const h = hostOf(reqUrl);
  if (!h || !firstPartyDomain) return false;
  return registrableDomain(h) !== firstPartyDomain;
}
function buildThirdParty(records, firstPartyDomain) {
  const byDomain = /* @__PURE__ */ new Map();
  const allIntervals = [];
  let requestCount = 0;
  let encodedKB = 0;
  for (const r of records) {
    if (!isThirdParty(r.url, firstPartyDomain)) continue;
    const host = hostOf(r.url);
    if (!host) continue;
    const domain = registrableDomain(host);
    const bucket = byDomain.get(domain) ?? byDomain.set(domain, { requestCount: 0, encodedKB: 0, intervals: [] }).get(domain);
    bucket.requestCount += 1;
    bucket.encodedKB += r.encodedKB;
    requestCount += 1;
    encodedKB += r.encodedKB;
    if (r.interval) {
      bucket.intervals.push(r.interval);
      allIntervals.push(r.interval);
    }
  }
  return {
    requestCount,
    encodedKB: round(encodedKB),
    busyMs: round(unionLength(allIntervals)),
    byDomain: [...byDomain.entries()].map(([domain, v]) => ({
      domain,
      requestCount: v.requestCount,
      encodedKB: round(v.encodedKB),
      busyMs: round(unionLength(v.intervals))
    })).sort((a, b) => b.encodedKB - a.encodedKB)
  };
}
function unionLength(intervals) {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    if (s > curEnd) {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else if (e > curEnd) {
      curEnd = e;
    }
  }
  total += curEnd - curStart;
  return total;
}
function pickAttribution(name, attr) {
  if (!attr) return {};
  const keys = {
    LCP: [
      "element",
      "url",
      "timeToFirstByte",
      "resourceLoadDelay",
      "resourceLoadDuration",
      "elementRenderDelay"
    ],
    INP: [
      "interactionTarget",
      "interactionType",
      "inputDelay",
      "processingDuration",
      "presentationDelay"
    ],
    CLS: ["largestShiftTarget", "largestShiftValue"]
  };
  const wanted = keys[name];
  if (!wanted) return {};
  const out = {};
  for (const k of wanted) {
    if (attr[k] !== void 0) out[k] = attr[k];
  }
  return out;
}
function buildGlobalNetwork(reqs, firstPartyDomain) {
  const byType = {};
  let totalEncoded = 0;
  const finished = [];
  const tpRecords = [];
  for (const r of reqs) {
    const encoded = r.encoded ?? 0;
    totalEncoded += encoded;
    const bucket = byType[r.type] ??= { count: 0, encodedKB: 0 };
    bucket.count += 1;
    bucket.encodedKB += encoded / 1024;
    if (r.endEpochMs != null) {
      finished.push({
        url: r.url,
        type: r.type,
        durationMs: round(r.endEpochMs - r.startEpochMs),
        kb: round(encoded / 1024)
      });
    }
    tpRecords.push({
      url: r.url,
      encodedKB: encoded / 1024,
      interval: r.endEpochMs != null ? [r.startEpochMs, r.endEpochMs] : void 0
    });
  }
  for (const b of Object.values(byType)) b.encodedKB = round(b.encodedKB);
  finished.sort((a, b) => b.durationMs - a.durationMs);
  return {
    totalRequests: reqs.length,
    totalEncodedKB: round(totalEncoded / 1024),
    byType,
    slowest: finished.slice(0, 8),
    thirdParty: buildThirdParty(tpRecords, firstPartyDomain)
  };
}
function buildSpanNetwork(span, reqs, firstPartyDomain) {
  const intervals = [];
  const requests = [];
  const tpRecords = [];
  let encoded = 0;
  for (const r of reqs) {
    const end = r.endEpochMs ?? r.startEpochMs;
    if (r.startEpochMs > span.endEpochMs || end < span.startEpochMs) continue;
    encoded += r.encoded ?? 0;
    const clipStart = Math.max(r.startEpochMs, span.startEpochMs);
    const clipEnd = Math.min(end, span.endEpochMs);
    const interval = clipEnd > clipStart ? [clipStart, clipEnd] : void 0;
    if (interval) intervals.push(interval);
    const tp = isThirdParty(r.url, firstPartyDomain);
    requests.push({
      url: r.url,
      type: r.type,
      startOffsetMs: round(r.startEpochMs - span.startEpochMs),
      durationMs: round(end - r.startEpochMs),
      kb: round((r.encoded ?? 0) / 1024),
      thirdParty: tp
    });
    tpRecords.push({ url: r.url, encodedKB: (r.encoded ?? 0) / 1024, interval });
  }
  requests.sort((a, b) => b.durationMs - a.durationMs);
  return {
    requestCount: requests.length,
    encodedKB: round(encoded / 1024),
    busyMs: round(unionLength(intervals)),
    waves: countWaves(intervals),
    thirdParty: buildThirdParty(tpRecords, firstPartyDomain),
    requests
  };
}
function countWaves(intervals) {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let waves = 1;
  let waveEnd = sorted[0][1];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    if (s > waveEnd) {
      waves += 1;
      waveEnd = e;
    } else {
      waveEnd = Math.max(waveEnd, e);
    }
  }
  return waves;
}
function buildTraceRender(events, startUs, endUs) {
  let paintCount = 0;
  let paintMs = 0;
  let gpuMs = 0;
  for (const e of events) {
    if (e.ph !== "X" || e.ts == null || e.dur == null) continue;
    if (e.ts < startUs || e.ts > endUs) continue;
    if (e.name === "Paint") {
      paintCount += 1;
      paintMs += e.dur / 1e3;
    } else if (e.name === "GPUTask") {
      gpuMs += e.dur / 1e3;
    }
  }
  return { paintCount, paintMs: round(paintMs), gpuMs: round(gpuMs) };
}
function buildSpanCpu(span, longTasks, loaf) {
  const inWindow = (epochStart) => epochStart >= span.startEpochMs && epochStart <= span.endEpochMs;
  const lt = longTasks.filter((t) => inWindow(t.epochStart));
  const lf = loaf.filter((l) => inWindow(l.epochStart));
  return {
    longTaskCount: lt.length,
    blockingMs: round(lt.reduce((a, t) => a + t.duration, 0)),
    maxLongTaskMs: round(lt.reduce((a, t) => Math.max(a, t.duration), 0)),
    loafCount: lf.length,
    maxLoafBlockingMs: round(lf.reduce((a, l) => Math.max(a, l.blocking), 0))
  };
}
function buildReport(testInfo, url, raw, timeOrigin, spans, reqs, traceEvents) {
  const pageHost = hostOf(url);
  const firstPartyDomain = pageHost ? registrableDomain(pageHost) : "";
  const vitals = {};
  for (const [name, m] of Object.entries(raw.vitals)) {
    vitals[name] = {
      value: round(m.value),
      rating: m.rating,
      attribution: pickAttribution(name, m.attribution)
    };
  }
  const longTasks = raw.longTasks.map((t) => ({
    epochStart: timeOrigin + t.start,
    duration: t.duration
  }));
  const loaf = raw.loaf.map((l) => ({
    epochStart: timeOrigin + l.start,
    duration: l.duration,
    blocking: l.blocking
  }));
  const spanReports = spans.map((s) => {
    const render = traceEvents ? {
      ...s.render,
      ...buildTraceRender(traceEvents, s.traceStartUs, s.traceEndUs)
    } : s.render;
    return {
      name: s.name,
      durationMs: round(s.endEpochMs - s.startEpochMs),
      capped: s.capped,
      network: buildSpanNetwork(s, reqs, firstPartyDomain),
      cpu: buildSpanCpu(s, longTasks, loaf),
      render,
      traceWindowUs: [s.traceStartUs, s.traceEndUs],
      budget: s.budget
    };
  });
  const measureLikes = raw.measures.map((m) => ({
    name: m.name,
    startTime: m.start,
    duration: m.duration,
    detail: m.detail
  }));
  const appSpans = toOtelSpans(measureLikes, timeOrigin).map(
    (s) => {
      const win = {
        startEpochMs: s.startUnixMs,
        endEpochMs: s.endUnixMs
      };
      return {
        ...s,
        network: buildSpanNetwork(win, reqs, firstPartyDomain),
        cpu: buildSpanCpu(win, longTasks, loaf)
      };
    }
  );
  return {
    title: testInfo.title,
    url,
    vitals,
    spans: spanReports,
    appSpans,
    network: buildGlobalNetwork(reqs, firstPartyDomain)
  };
}
function logSummary(report) {
  const lines = [`
[perf] ${report.title}`];
  const v = report.vitals;
  const fmt = (s) => s ? `${s.value} (${s.rating})` : "n/a";
  lines.push(
    `  vitals  LCP=${fmt(v.LCP)}  INP=${fmt(v.INP)}  CLS=${fmt(v.CLS)}  TTFB=${fmt(v.TTFB)}`
  );
  for (const s of report.spans) {
    lines.push(
      `  ${s.name.padEnd(26)} ${String(s.durationMs).padStart(7)}ms${s.capped ? " (capped)" : ""}`
    );
    const saturated = s.durationMs > 50 && s.network.busyMs / s.durationMs > 0.9;
    lines.push(
      `      net   busy=${s.network.busyMs}ms  ${s.network.requestCount}reqs  ${s.network.waves}waves  ${s.network.encodedKB}KB` + (saturated ? "  (net-saturated: busyMs \u2248 window)" : "")
    );
    const tp = s.network.thirdParty;
    if (tp.requestCount > 0) {
      const top = tp.byDomain.slice(0, 3).map((d) => `${d.domain} ${d.encodedKB}KB`).join(", ");
      lines.push(
        `      3p    ${tp.requestCount}reqs  ${tp.encodedKB}KB  busy=${tp.busyMs}ms  [${top}]`
      );
    }
    lines.push(
      `      cpu   block=${s.cpu.blockingMs}ms  longtasks=${s.cpu.longTaskCount}  maxTask=${s.cpu.maxLongTaskMs}ms  loaf=${s.cpu.loafCount}/${s.cpu.maxLoafBlockingMs}ms`
    );
    const r = s.render;
    const paint = r.paintCount !== void 0 ? `  paint=${r.paintCount}/${r.paintMs}ms  gpu=${r.gpuMs}ms` : "";
    lines.push(
      `      render style=${r.recalcStyleCount}/${r.recalcStyleMs}ms  layout=${r.layoutCount}/${r.layoutMs}ms  nodes=${r.nodes}  script=${r.scriptMs}ms${paint}`
    );
  }
  if (report.appSpans.length > 0) {
    const depthOf = (s) => {
      if (!s.parentSpanId) return 0;
      const parent = report.appSpans.find((p) => p.spanId === s.parentSpanId);
      return parent ? depthOf(parent) + 1 : 0;
    };
    lines.push("  app spans (performance.measure):");
    for (const s of report.appSpans) {
      const indent = "    " + "  ".repeat(depthOf(s));
      lines.push(
        `${indent}${s.name} ${round(s.durationMs)}ms  net=${s.network.busyMs}ms/${s.network.encodedKB}KB  cpu=${s.cpu.blockingMs}ms`
      );
    }
  }
  lines.push(
    `  total network ${report.network.totalRequests} reqs / ${report.network.totalEncodedKB}KB`
  );
  const gtp = report.network.thirdParty;
  if (gtp.requestCount > 0) {
    const share = report.network.totalEncodedKB ? Math.round(gtp.encodedKB / report.network.totalEncodedKB * 100) : 0;
    lines.push(
      `    third-party ${gtp.requestCount} reqs / ${gtp.encodedKB}KB (${share}% of bytes) across ${gtp.byDomain.length} domains`
    );
  }
  const violations = checkBudgets(report);
  for (const v2 of violations) {
    lines.push(`  ! budget: ${v2}`);
  }
  if (report.collectorMissing) {
    lines.push(
      "  ! in-page collector did not run \u2014 vitals / cpu / render are missing. Navigate with page.goto (page.setContent does not trigger init scripts)."
    );
  }
  if (report.glRenderer && /swiftshader/i.test(report.glRenderer)) {
    lines.push(
      "  ! software GL (SwiftShader): GPU / render numbers are NOT real hardware. Use PERF_GPU=1."
    );
  }
  if (report.pageErrors && report.pageErrors.length > 0) {
    lines.push(
      `  ! ${report.pageErrors.length} page error(s) during measurement \u2014 results may be invalid:`
    );
    for (const e of report.pageErrors.slice(0, 3)) {
      lines.push(`      ${e.split("\n")[0]}`);
    }
  }
  console.log(lines.join("\n"));
}
var test = base.extend({
  perf: async ({ page }, use, testInfo) => {
    await page.addInitScript({ content: WEB_VITALS_IIFE });
    await page.addInitScript(browserCollector);
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    if (CPU_RATE > 1 && testInfo.timeout > 0) {
      testInfo.setTimeout(testInfo.timeout * CPU_RATE);
    }
    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");
    if (CPU_RATE > 1) {
      await client.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });
    }
    const finishNetwork = await startNetworkCapture(client);
    if (NET_PROFILE) {
      await client.send("Network.emulateNetworkConditions", {
        offline: false,
        ...NET_PROFILE
      });
    }
    const finishTrace = TRACE_ENABLED ? await startTrace(client) : void 0;
    const controller = new PerfController(page, client);
    await use(controller);
    await page.evaluate(() => window.__perf?.flush?.()).catch(() => {
    });
    const raw = await page.evaluate(() => window.__perf).catch(() => void 0);
    const timeOrigin = await page.evaluate(() => performance.timeOrigin).catch(() => 0);
    const glRenderer = await page.evaluate(() => {
      try {
        const gl = document.createElement("canvas").getContext("webgl");
        if (!gl) return null;
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      } catch {
        return null;
      }
    }).catch(() => null);
    const url = page.url();
    const reqs = finishNetwork();
    const traceEvents = finishTrace ? await finishTrace() : void 0;
    fs.mkdirSync(PERF_OUT_DIR, { recursive: true });
    const slug = testInfo.titlePath.filter(Boolean).join("_").replace(/[^\p{L}\p{N}_]+/gu, "_");
    const runTag = `run${testInfo.repeatEachIndex}`;
    const report = buildReport(
      testInfo,
      url,
      raw ?? { vitals: {}, longTasks: [], loaf: [], measures: [] },
      timeOrigin,
      controller.spans,
      reqs,
      traceEvents
    );
    if (glRenderer) report.glRenderer = glRenderer;
    if (pageErrors.length) report.pageErrors = pageErrors;
    if (Object.keys(controller.vitalsBudget).length > 0)
      report.vitalsBudget = controller.vitalsBudget;
    if (raw === void 0) report.collectorMissing = true;
    if (traceEvents) {
      const tracePath = path.join(PERF_OUT_DIR, `${slug}.${runTag}.trace.json`);
      fs.writeFileSync(tracePath, JSON.stringify(traceEvents));
      report.tracePath = tracePath;
    }
    const jsonPath = path.join(PERF_OUT_DIR, `${slug}.${runTag}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    await testInfo.attach("perf-report", {
      path: jsonPath,
      contentType: "application/json"
    });
    logSummary(report);
    if (process.env.PERF_ASSERT === "1") {
      const violations = checkBudgets(report);
      if (violations.length > 0) {
        throw new Error(`perf budget exceeded:
  ${violations.join("\n  ")}`);
      }
    }
  }
});

// src/trace.ts
var markCounter = 0;
var hasUserTiming = typeof performance !== "undefined" && typeof performance.mark === "function" && typeof performance.measure === "function";
var noopSpan = {
  setAttribute() {
  },
  end() {
  }
};
function startSpan(name, attributes = {}) {
  if (!hasUserTiming) return noopSpan;
  const startMark = `\u2063${name}\u2063${++markCounter}`;
  performance.mark(startMark);
  const attrs = { ...attributes };
  let ended = false;
  return {
    setAttribute(key, value) {
      attrs[key] = value;
    },
    end() {
      if (ended) return;
      ended = true;
      performance.measure(name, {
        start: startMark,
        detail: { __lbSpan: true, attributes: attrs }
      });
      performance.clearMarks(startMark);
    }
  };
}
function withSpan(name, fn, attributes = {}) {
  const span = startSpan(name, attributes);
  let result;
  try {
    result = fn();
  } catch (e) {
    span.end();
    throw e;
  }
  if (result instanceof Promise) {
    return result.finally(() => span.end());
  }
  span.end();
  return result;
}
if (import.meta.vitest) {
  const { describe, it, expect: expect2, beforeEach } = import.meta.vitest;
  const measures = () => performance.getEntriesByType("measure");
  describe("withSpan / startSpan", () => {
    beforeEach(() => {
      performance.clearMeasures();
      performance.clearMarks();
    });
    it("emits a measure named after the span", () => {
      withSpan("sync-op", () => 42);
      expect2(measures().some((m) => m.name === "sync-op")).toBe(true);
    });
    it("returns the fn result unchanged", () => {
      expect2(withSpan("op", () => 42)).toBe(42);
    });
    it("emits the measure after an async fn resolves", async () => {
      const p = withSpan("async-op", () => Promise.resolve("done"));
      expect2(measures().some((m) => m.name === "async-op")).toBe(false);
      await p;
      expect2(measures().some((m) => m.name === "async-op")).toBe(true);
    });
    it("closes the span and rethrows when fn throws", () => {
      expect2(
        () => withSpan("throwing", () => {
          throw new Error("boom");
        })
      ).toThrow("boom");
      expect2(measures().some((m) => m.name === "throwing")).toBe(true);
    });
    it("emits only one measure even if end() is called twice", () => {
      const span = startSpan("once");
      span.end();
      span.end();
      expect2(measures().filter((m) => m.name === "once")).toHaveLength(1);
    });
  });
}
export {
  PerfController,
  expect,
  startSpan,
  test,
  toOtelSpans,
  withSpan
};
