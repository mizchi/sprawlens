import { hierarchy, treemap } from "d3-hierarchy";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { moduleIdForFilePath } from "../core/moduleMap.js";
import type { CodeEdge, FileNode, GraphDiff, Hotspot, ImportsEdge, Snapshot } from "../core/types.js";
import { ModuleCityMap } from "./ModuleCityMap.js";
import { SymbolMapView } from "./SymbolMapView.js";

type SnapshotSummary = Pick<Snapshot, "commit" | "metrics">;
type DiffSummary = Pick<GraphDiff, "fromCommit" | "toCommit" | "metricDelta" | "hotspots">;
type MetricKey = "loc" | "fileCount" | "importEdgeCount" | "cycleCount" | "largestComponentSize";
type ViewMode = "overview" | "diff" | "realtime" | "network";
type RealtimePayload = {
  baseSnapshot: Snapshot;
  currentSnapshot: Snapshot;
  diff: GraphDiff;
  status: string[];
};

const METRICS: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: "loc", label: "LOC", color: "#2563eb" },
  { key: "fileCount", label: "Files", color: "#0f766e" },
  { key: "importEdgeCount", label: "Imports", color: "#7c3aed" },
  { key: "cycleCount", label: "Cycles", color: "#dc2626" },
  { key: "largestComponentSize", label: "Largest component", color: "#b45309" },
];

const VIEW_TABS: Array<{ mode: ViewMode; label: string }> = [
  { mode: "overview", label: "Overview" },
  { mode: "network", label: "Symbol Map" },
  { mode: "diff", label: "Diff View" },
  { mode: "realtime", label: "Realtime" },
];

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => viewModeFromHash());
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [diffs, setDiffs] = useState<DiffSummary[]>([]);
  const [fromCommit, setFromCommit] = useState<string>("");
  const [toCommit, setToCommit] = useState<string>("");
  const [fromSnapshot, setFromSnapshot] = useState<Snapshot | null>(null);
  const [toSnapshot, setToSnapshot] = useState<Snapshot | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<GraphDiff | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [enabledMetrics, setEnabledMetrics] = useState<MetricKey[]>([
    "loc",
    "fileCount",
    "importEdgeCount",
    "cycleCount",
    "largestComponentSize",
  ]);
  const [error, setError] = useState<string>("");
  const [realtime, setRealtime] = useState<RealtimePayload | null>(null);
  const [realtimeLoading, setRealtimeLoading] = useState(false);

  const loadIndex = useCallback(async () => {
    setError("");
    try {
      const [snapshotResponse, diffResponse] = await Promise.all([fetch("/api/snapshots"), fetch("/api/diffs")]);
      if (!snapshotResponse.ok) {
        throw new Error("No .codesprawl data available");
      }
      const nextSnapshots = (await snapshotResponse.json()) as SnapshotSummary[];
      const nextDiffs = diffResponse.ok ? ((await diffResponse.json()) as DiffSummary[]) : [];
      setSnapshots(nextSnapshots);
      setDiffs(nextDiffs);

      const latestDiff = nextDiffs.at(-1);
      if (latestDiff) {
        setFromCommit(latestDiff.fromCommit);
        setToCommit(latestDiff.toCommit);
      } else {
        const latest = nextSnapshots.at(-1);
        const previous = nextSnapshots.at(-2);
        setFromCommit(previous?.commit.hash ?? latest?.commit.hash ?? "");
        setToCommit(latest?.commit.hash ?? "");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load data");
    }
  }, []);

  const loadRealtime = useCallback(async () => {
    setRealtimeLoading(true);
    setError("");
    try {
      const response = await fetch("/api/realtime");
      if (!response.ok) {
        throw new Error("Unable to analyze working tree");
      }
      setRealtime((await response.json()) as RealtimePayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load realtime data");
    } finally {
      setRealtimeLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    if (viewMode === "realtime") {
      void loadRealtime();
    }
  }, [loadRealtime, viewMode]);

  useEffect(() => {
    function onHashChange() {
      setViewMode(viewModeFromHash());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    async function loadPair() {
      if (!toCommit) {
        return;
      }
      const [toResponse, fromResponse, diffResponse] = await Promise.all([
        fetch(`/api/snapshots/${toCommit}`),
        fromCommit ? fetch(`/api/snapshots/${fromCommit}`) : Promise.resolve(null),
        fromCommit && fromCommit !== toCommit ? fetch(`/api/diffs/${fromCommit}..${toCommit}.json`) : Promise.resolve(null),
      ]);

      setToSnapshot(toResponse.ok ? ((await toResponse.json()) as Snapshot) : null);
      setFromSnapshot(fromResponse?.ok ? ((await fromResponse.json()) as Snapshot) : null);
      setSelectedDiff(diffResponse?.ok ? ((await diffResponse.json()) as GraphDiff) : null);
    }

    void loadPair();
  }, [fromCommit, toCommit]);

  useEffect(() => {
    const topHotspot = selectedDiff?.hotspots[0]?.path;
    if (topHotspot) {
      setSelectedFile(topHotspot);
      setSelectedModuleId(moduleIdForFilePath(topHotspot));
    }
  }, [selectedDiff?.fromCommit, selectedDiff?.toCommit]);

  useEffect(() => {
    if (selectedFile) {
      setSelectedModuleId(moduleIdForFilePath(selectedFile));
    }
  }, [selectedFile]);

  const selectedDiffSummary = useMemo(
    () => diffs.find((diff) => diff.fromCommit === fromCommit && diff.toCommit === toCommit),
    [diffs, fromCommit, toCommit],
  );

  const activeDiff = selectedDiff ?? selectedDiffSummary ?? null;
  const refreshCurrentView = useCallback(async () => {
    if (viewMode === "realtime") {
      await loadRealtime();
      return;
    }
    await loadIndex();
  }, [loadIndex, loadRealtime, viewMode]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>CodeSprawl Lens</h1>
        </div>
        <div className="topbar-controls">
          <ModeSelector viewMode={viewMode} onViewMode={setViewHash} />
          {viewMode === "overview" || viewMode === "network" ? (
            <SnapshotSelector
              snapshots={snapshots}
              selectedCommit={toCommit}
              onCommit={(commitHash) => selectSnapshot(commitHash, snapshots, setFromCommit, setToCommit)}
            />
          ) : null}
          {viewMode === "diff" ? (
            <CommitPairSelector
              snapshots={snapshots}
              fromCommit={fromCommit}
              toCommit={toCommit}
              onFromCommit={setFromCommit}
              onToCommit={setToCommit}
            />
          ) : null}
          {viewMode === "realtime" ? <span className="mode-meta">{realtime?.status.length ? `${realtime.status.length} working changes` : "Working tree"}</span> : null}
          <button className="icon-button" type="button" onClick={() => void refreshCurrentView()} aria-label="Refresh data">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      {viewMode === "overview" ? (
        <section className="map-screen">
          <ModuleCityMap
            snapshot={toSnapshot}
            diff={selectedDiff}
            selectedFile={selectedFile}
            selectedModuleId={selectedModuleId}
            onSelectFile={setSelectedFile}
            onSelectModule={setSelectedModuleId}
          />
          <div className="map-popovers" aria-label="Auxiliary panels">
            <details className="map-popover">
              <summary>Metrics</summary>
              <SnapshotMetricsPanel snapshot={toSnapshot} />
            </details>
            <details className="map-popover">
              <summary>Timeline</summary>
              <MetricToggles enabledMetrics={enabledMetrics} onChange={setEnabledMetrics} />
              <Timeline
                snapshots={snapshots}
                enabledMetrics={enabledMetrics}
                selectedCommit={toCommit}
                onSelectCommit={(commitHash) => selectSnapshot(commitHash, snapshots, setFromCommit, setToCommit)}
              />
            </details>
            <details className="map-popover">
              <summary>File treemap</summary>
              <TreemapView snapshot={toSnapshot} diff={selectedDiff} selectedFile={selectedFile} onSelectFile={setSelectedFile} />
            </details>
          </div>
        </section>
      ) : null}

      {viewMode === "diff" ? (
        <section className="section screen-section">
          <div className="section-head">
            <h2>Diff View</h2>
            <CommitPairSelector
              snapshots={snapshots}
              fromCommit={fromCommit}
              toCommit={toCommit}
              onFromCommit={setFromCommit}
              onToCommit={setToCommit}
            />
          </div>
          <MetricDeltaCards diff={activeDiff} />
          <div className="dependency-pane">
            <div className="sub-head">
              <strong>Dependency Diff</strong>
              <span>{selectedFile || "No file selected"}</span>
            </div>
            <DependencyDiff snapshot={toSnapshot} beforeSnapshot={fromSnapshot} diff={selectedDiff} selectedFile={selectedFile} />
          </div>
          <HotspotList hotspots={activeDiff?.hotspots ?? []} selectedFile={selectedFile} onSelectFile={setSelectedFile} />
        </section>
      ) : null}

      {viewMode === "realtime" ? (
        <section className="section screen-section">
          <div className="section-head">
            <h2>Realtime</h2>
            <button className="text-button" type="button" onClick={() => void loadRealtime()} disabled={realtimeLoading}>
              {realtimeLoading ? "Analyzing..." : "Refresh"}
            </button>
          </div>
          <RealtimeStatus status={realtime?.status ?? []} />
          <MetricDeltaCards diff={realtime?.diff ?? null} />
          <TreemapView
            snapshot={realtime?.currentSnapshot ?? null}
            diff={realtime?.diff ?? null}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
          />
          <DependencyDiff
            snapshot={realtime?.currentSnapshot ?? null}
            beforeSnapshot={realtime?.baseSnapshot ?? null}
            diff={realtime?.diff ?? null}
            selectedFile={selectedFile}
          />
          <HotspotList hotspots={realtime?.diff.hotspots ?? []} selectedFile={selectedFile} onSelectFile={setSelectedFile} />
        </section>
      ) : null}

      {viewMode === "network" ? (
        <section className="graph-screen-section">
          <SymbolMapView
            snapshot={toSnapshot}
            diff={selectedDiff}
            selectedFile={selectedFile}
            selectedModuleId={selectedModuleId}
            onSelectFile={setSelectedFile}
            onSelectModule={setSelectedModuleId}
          />
        </section>
      ) : null}
    </main>
  );
}

function selectSnapshot(
  commitHash: string,
  snapshots: SnapshotSummary[],
  onFromCommit: (hash: string) => void,
  onToCommit: (hash: string) => void,
) {
  const index = snapshots.findIndex((snapshot) => snapshot.commit.hash === commitHash);
  onToCommit(commitHash);
  onFromCommit(snapshots[Math.max(0, index - 1)]?.commit.hash ?? commitHash);
}

function ModeSelector(props: { viewMode: ViewMode; onViewMode: (mode: ViewMode) => void }) {
  return (
    <label className="mode-selector">
      Mode
      <select value={props.viewMode} onChange={(event) => props.onViewMode(event.target.value as ViewMode)}>
        {VIEW_TABS.map((tab) => (
          <option key={tab.mode} value={tab.mode}>
            {tab.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SnapshotSelector(props: {
  snapshots: SnapshotSummary[];
  selectedCommit: string;
  onCommit: (hash: string) => void;
}) {
  return (
    <label className="snapshot-selector">
      Snapshot
      <select value={props.selectedCommit} onChange={(event) => props.onCommit(event.target.value)}>
        {props.snapshots.map((snapshot) => (
          <option key={snapshot.commit.hash} value={snapshot.commit.hash}>
            {snapshot.commit.shortHash} {formatDate(snapshot.commit.timestamp)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CommitPairSelector(props: {
  snapshots: SnapshotSummary[];
  fromCommit: string;
  toCommit: string;
  onFromCommit: (hash: string) => void;
  onToCommit: (hash: string) => void;
}) {
  return (
    <div className="commit-selector">
      <label>
        From
        <select value={props.fromCommit} onChange={(event) => props.onFromCommit(event.target.value)}>
          {props.snapshots.map((snapshot) => (
            <option key={snapshot.commit.hash} value={snapshot.commit.hash}>
              {snapshot.commit.shortHash} {formatDate(snapshot.commit.timestamp)}
            </option>
          ))}
        </select>
      </label>
      <label>
        To
        <select value={props.toCommit} onChange={(event) => props.onToCommit(event.target.value)}>
          {props.snapshots.map((snapshot) => (
            <option key={snapshot.commit.hash} value={snapshot.commit.hash}>
              {snapshot.commit.shortHash} {formatDate(snapshot.commit.timestamp)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function MetricToggles(props: { enabledMetrics: MetricKey[]; onChange: (metrics: MetricKey[]) => void }) {
  return (
    <div className="metric-toggles">
      {METRICS.map((metric) => (
        <label key={metric.key} style={{ "--metric-color": metric.color } as CSSProperties}>
          <input
            type="checkbox"
            checked={props.enabledMetrics.includes(metric.key)}
            onChange={(event) => {
              props.onChange(
                event.target.checked
                  ? [...props.enabledMetrics, metric.key]
                  : props.enabledMetrics.filter((enabled) => enabled !== metric.key),
              );
            }}
          />
          <span>{metric.label}</span>
        </label>
      ))}
    </div>
  );
}

function SnapshotMetricsPanel(props: { snapshot: Snapshot | null }) {
  if (!props.snapshot) {
    return <aside className="metrics-panel empty-state">No snapshot</aside>;
  }

  const metrics = props.snapshot.metrics;
  const items: Array<{ label: string; value: number }> = [
    { label: "LOC", value: metrics.loc },
    { label: "Files", value: metrics.fileCount },
    { label: "Imports", value: metrics.importEdgeCount },
    { label: "Unresolved", value: metrics.unresolvedImportCount },
    { label: "Cycles", value: metrics.cycleCount },
    { label: "Largest component", value: metrics.largestComponentSize },
    { label: "Max fan-in", value: metrics.maxFanIn },
    { label: "Max fan-out", value: metrics.maxFanOut },
  ];

  return (
    <aside className="metrics-panel">
      <div className="section-head compact">
        <h2>Snapshot</h2>
        <span className="meta-label">{formatDate(props.snapshot.commit.timestamp)}</span>
      </div>
      <dl className="metric-list">
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{formatNumber(item.value)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function MetricDeltaCards(props: { diff: Pick<GraphDiff, "metricDelta"> | null }) {
  const delta = props.diff?.metricDelta;
  const items: Array<{ key: MetricKey; label: string }> = [
    { key: "loc", label: "LOC" },
    { key: "fileCount", label: "Files" },
    { key: "importEdgeCount", label: "Imports" },
    { key: "cycleCount", label: "Cycles" },
    { key: "largestComponentSize", label: "Largest component" },
  ];

  return (
    <div className="delta-cards">
      {items.map((item) => {
        const value = Number(delta?.[item.key] ?? 0);
        return (
          <div key={item.key} className={value > 0 ? "delta-card positive" : value < 0 ? "delta-card negative" : "delta-card"}>
            <span>{item.label}</span>
            <strong>{formatSigned(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function RealtimeStatus(props: { status: string[] }) {
  return (
    <section className="realtime-status">
      <div className="sub-head">
        <strong>Working Tree</strong>
        <span>{props.status.length ? `${props.status.length} changed paths` : "No uncommitted changes"}</span>
      </div>
      {props.status.length ? (
        <ul>
          {props.status.slice(0, 12).map((line) => (
            <li key={line}>{line}</li>
          ))}
          {props.status.length > 12 ? <li>+{props.status.length - 12} more</li> : null}
        </ul>
      ) : null}
    </section>
  );
}

function Timeline(props: {
  snapshots: SnapshotSummary[];
  enabledMetrics: MetricKey[];
  selectedCommit: string;
  onSelectCommit: (hash: string) => void;
}) {
  const width = 1120;
  const height = 260;
  const padding = { top: 18, right: 28, bottom: 34, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xFor = (index: number) =>
    padding.left + (props.snapshots.length <= 1 ? plotWidth / 2 : (index / (props.snapshots.length - 1)) * plotWidth);

  return (
    <svg className="timeline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Metric timeline">
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="axis" />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="axis" />
      {METRICS.filter((metric) => props.enabledMetrics.includes(metric.key)).map((metric) => {
        const values = props.snapshots.map((snapshot) => Number(snapshot.metrics[metric.key]));
        const max = Math.max(...values, 1);
        const points = values.map((value, index) => {
          const x = xFor(index);
          const y = padding.top + plotHeight - (value / max) * plotHeight;
          return `${x},${y}`;
        });
        return <polyline key={metric.key} points={points.join(" ")} fill="none" stroke={metric.color} strokeWidth={3} />;
      })}
      {props.snapshots.map((snapshot, index) => {
        const x = xFor(index);
        const y = height - padding.bottom;
        const likelyAI = snapshot.commit.aiIndicators.length > 0;
        return (
          <g key={snapshot.commit.hash} className="timeline-point" onClick={() => props.onSelectCommit(snapshot.commit.hash)}>
            <circle
              cx={x}
              cy={y}
              r={snapshot.commit.hash === props.selectedCommit ? 7 : 5}
              className={snapshot.commit.hash === props.selectedCommit ? "selected-point" : ""}
            />
            {likelyAI ? <polygon points={`${x},${padding.top - 2} ${x - 6},${padding.top + 10} ${x + 6},${padding.top + 10}`} className="ai-marker" /> : null}
            <title>
              {snapshot.commit.shortHash} {formatDate(snapshot.commit.timestamp)}
            </title>
          </g>
        );
      })}
    </svg>
  );
}

function TreemapView(props: {
  snapshot: Snapshot | null;
  diff: Pick<GraphDiff, "changedFiles" | "hotspots"> | null;
  selectedFile: string;
  onSelectFile: (path: string) => void;
}) {
  const [wrapRef, wrapSize] = useElementSize<HTMLDivElement>();
  const width = measuredLength(wrapSize.width);
  const height = measuredLength(width * 0.42);
  const [hovered, setHovered] = useState<TreemapHover | null>(null);
  const fileNodes = useMemo(() => props.snapshot?.nodes.filter((node): node is FileNode => node.type === "file") ?? [], [props.snapshot]);
  const locDelta = useMemo(() => new Map(props.diff?.changedFiles.map((file) => [file.path, file.locDelta]) ?? []), [props.diff]);
  const hotspots = useMemo(() => new Map(props.diff?.hotspots.map((hotspot) => [hotspot.path, hotspot]) ?? []), [props.diff]);
  const root = useMemo(() => buildTreemapRoot(fileNodes), [fileNodes]);
  const leaves = useMemo(() => {
    if (!root) {
      return [];
    }
    return treemap<TreeNode>().size([width, height]).paddingInner(2).round(true)(root).leaves();
  }, [root]);

  if (!props.snapshot) {
    return <div className="empty-state">No snapshot</div>;
  }

  return (
    <div ref={wrapRef} className="treemap-wrap" onPointerLeave={() => setHovered(null)}>
      <svg className="treemap" viewBox={`0 0 ${width} ${height}`} style={{ height }} role="img" aria-label="Repository treemap">
        {leaves.map((leaf) => {
          const filePath = leaf.data.path ?? leaf.data.name;
          const delta = locDelta.get(filePath) ?? 0;
          const hotspot = hotspots.get(filePath);
          const isHotspot = Boolean(hotspot);
          const isSelected = props.selectedFile === filePath;
          const isHovered = hovered?.path === filePath;
          const widthPx = leaf.x1 - leaf.x0;
          const heightPx = leaf.y1 - leaf.y0;
          const loc = Number(leaf.value ?? 0);
          return (
            <g
              key={filePath}
              onClick={() => props.onSelectFile(filePath)}
              onPointerMove={(event) => setHovered(toTreemapHover(event, filePath, loc, delta, hotspot))}
              className="treemap-cell"
            >
              <rect
                x={leaf.x0}
                y={leaf.y0}
                width={widthPx}
                height={heightPx}
                className={cellClass(delta, isHotspot, isSelected || isHovered)}
              />
              {(isSelected || isHovered) && widthPx > 84 && heightPx > 34 ? (
                <>
                  <text x={leaf.x0 + 8} y={leaf.y0 + 18} className="cell-label">
                    {basename(filePath)}
                  </text>
                  <text x={leaf.x0 + 8} y={leaf.y0 + 34} className="cell-sub">
                    {loc} LOC {formatSigned(delta)}
                  </text>
                </>
              ) : null}
              {isHotspot && widthPx > 24 && heightPx > 24 ? <AlertTriangleMarker x={leaf.x1 - 22} y={leaf.y0 + 7} /> : null}
            </g>
          );
        })}
      </svg>
      {hovered ? <TreemapTooltip hover={hovered} /> : null}
    </div>
  );
}

type TreemapHover = {
  path: string;
  loc: number;
  delta: number;
  hotspot?: Hotspot;
  x: number;
  y: number;
};

function toTreemapHover(
  event: PointerEvent<SVGGElement>,
  filePath: string,
  loc: number,
  delta: number,
  hotspot?: Hotspot,
): TreemapHover {
  const svgRect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
  return {
    path: filePath,
    loc,
    delta,
    hotspot,
    x: svgRect ? event.clientX - svgRect.left + 14 : 14,
    y: svgRect ? event.clientY - svgRect.top + 14 : 14,
  };
}

function TreemapTooltip(props: { hover: TreemapHover }) {
  return (
    <div className="treemap-tooltip" style={{ left: props.hover.x, top: props.hover.y }}>
      <strong>{basename(props.hover.path)}</strong>
      <span>{props.hover.path}</span>
      <dl>
        <div>
          <dt>LOC</dt>
          <dd>{formatNumber(props.hover.loc)}</dd>
        </div>
        <div>
          <dt>Delta</dt>
          <dd>{formatSigned(props.hover.delta)}</dd>
        </div>
        {props.hover.hotspot ? (
          <div>
            <dt>Score</dt>
            <dd>{props.hover.hotspot.score}</dd>
          </div>
        ) : null}
      </dl>
      {props.hover.hotspot?.reasons.length ? <small>{props.hover.hotspot.reasons.join(", ")}</small> : null}
    </div>
  );
}

function HotspotList(props: { hotspots: Hotspot[]; selectedFile: string; onSelectFile: (path: string) => void }) {
  return (
    <aside className="hotspot-pane">
      <div className="section-head compact">
        <h2>Hotspots</h2>
        <span className="meta-label">{props.hotspots.length}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Path</th>
              <th>Score</th>
              <th>Reasons</th>
            </tr>
          </thead>
          <tbody>
            {props.hotspots.map((hotspot) => (
              <tr
                key={hotspot.path}
                className={props.selectedFile === hotspot.path ? "selected-row" : ""}
                onClick={() => props.onSelectFile(hotspot.path)}
              >
                <td>{hotspot.path}</td>
                <td>{hotspot.score}</td>
                <td>{hotspot.reasons.join(", ")}</td>
              </tr>
            ))}
            {props.hotspots.length === 0 ? (
              <tr>
                <td colSpan={3} className="empty-cell">
                  No hotspots
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </aside>
  );
}

function DependencyDiff(props: {
  snapshot: Snapshot | null;
  beforeSnapshot: Snapshot | null;
  diff: GraphDiff | null;
  selectedFile: string;
}) {
  const [wrapRef, wrapSize] = useElementSize<HTMLDivElement>();
  const width = measuredLength(wrapSize.width);
  const viewportHeight = typeof window === "undefined" ? wrapSize.height : window.innerHeight;
  const height = measuredLength(Math.max(240, Math.min(width * 0.42, viewportHeight * 0.48)));
  const nodeWidth = measuredLength(Math.min(190, Math.max(78, width * 0.2)));
  const nodeHalfWidth = nodeWidth / 2;
  const visibleNeighborLimit = Math.max(2, Math.min(MAX_GRAPH_NEIGHBORS, Math.floor((height * 0.74) / 52)));
  const graph = useMemo(
    () => dependencyNeighborhood(props.snapshot, props.beforeSnapshot, props.diff, props.selectedFile, visibleNeighborLimit),
    [props.snapshot, props.beforeSnapshot, props.diff, props.selectedFile, visibleNeighborLimit],
  );

  if (!props.snapshot || !props.selectedFile) {
    return <div className="empty-state">No dependency selection</div>;
  }

  return (
    <div ref={wrapRef} className="dependency-layout">
      <svg className="dependency" viewBox={`0 0 ${width} ${height}`} style={{ height }} role="img" aria-label="Dependency neighborhood">
        {graph.edges.map((edge) => {
          const from = graph.nodes.get(edge.from);
          const to = graph.nodes.get(edge.to);
          if (!from || !to) {
            return null;
          }
          const fromPoint = dependencyPoint(from, width, height);
          const toPoint = dependencyPoint(to, width, height);
          return (
            <line
              key={edge.id}
              x1={fromPoint.x}
              y1={fromPoint.y}
              x2={toPoint.x}
              y2={toPoint.y}
              className={`dep-edge ${edge.status}`}
              markerEnd="url(#arrow)"
            />
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L7,3 z" fill="currentColor" />
          </marker>
        </defs>
        {[...graph.nodes.values()].map((node) => (
          <g
            key={node.id}
            transform={`translate(${dependencyPoint(node, width, height).x} ${dependencyPoint(node, width, height).y})`}
            className={node.path === props.selectedFile ? "dep-node selected" : "dep-node"}
          >
            <rect x={-nodeHalfWidth} y="-22" width={nodeWidth} height="44" rx="7" />
            <text textAnchor="middle" y="-2">
              {basename(node.path)}
            </text>
            <text textAnchor="middle" y="14" className="dep-sub">
              {shortenMiddle(node.path, Math.floor(nodeWidth / 5))}
            </text>
          </g>
        ))}
        {graph.incomingHidden > 0 ? (
          <text x={width * 0.16} y={height - 24} textAnchor="middle" className="dep-more">
            +{graph.incomingHidden} more incoming
          </text>
        ) : null}
        {graph.outgoingHidden > 0 ? (
          <text x={width * 0.84} y={height - 24} textAnchor="middle" className="dep-more">
            +{graph.outgoingHidden} more outgoing
          </text>
        ) : null}
      </svg>
      <div className="dependency-lists">
        <NeighborList title="Incoming" items={graph.incoming} />
        <NeighborList title="Outgoing" items={graph.outgoing} />
      </div>
    </div>
  );
}

function NeighborList(props: { title: string; items: DepNeighbor[] }) {
  return (
    <section className="neighbor-list">
      <h3>
        {props.title} <span>{props.items.length}</span>
      </h3>
      <ul>
        {props.items.map((item) => (
          <li key={item.id}>
            <span className={`neighbor-status ${item.status}`}>{item.status}</span>
            <span>{item.path}</span>
          </li>
        ))}
        {props.items.length === 0 ? <li className="empty-neighbor">None</li> : null}
      </ul>
    </section>
  );
}

type TreeNode = {
  name: string;
  path?: string;
  children?: TreeNode[];
  value?: number;
};

function buildTreemapRoot(files: FileNode[]) {
  if (files.length === 0) {
    return null;
  }
  const root: TreeNode = { name: "repo", children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (const [index, part] of parts.entries()) {
      const isFile = index === parts.length - 1;
      current.children ??= [];
      let child = current.children.find((item) => item.name === part);
      if (!child) {
        child = isFile ? { name: part, path: file.path, value: Math.max(file.loc, 1) } : { name: part, children: [] };
        current.children.push(child);
      }
      current = child;
    }
  }

  return hierarchy(root)
    .sum((node) => node.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

type DepStatus = "added" | "removed" | "stable";

type DepEdge = ImportsEdge & {
  status: DepStatus;
};

type DepNeighbor = {
  id: string;
  path: string;
  status: DepStatus;
};

type DepNodePlacement = {
  id: string;
  path: string;
  column: "incoming" | "selected" | "outgoing";
  index: number;
  total: number;
};

const MAX_GRAPH_NEIGHBORS = 8;

function viewModeFromHash(): ViewMode {
  const mode = window.location.hash.slice(1);
  if (mode === "overview" || mode === "diff" || mode === "realtime" || mode === "network") {
    return mode;
  }
  if (mode === "map" || mode === "hotspots" || mode === "timeline") {
    return mode === "timeline" || mode === "map" ? "overview" : "diff";
  }
  return "overview";
}

function setViewHash(mode: ViewMode) {
  window.location.hash = mode;
}

function dependencyNeighborhood(
  snapshot: Snapshot | null,
  beforeSnapshot: Snapshot | null,
  diff: GraphDiff | null,
  selectedFile: string,
  visibleNeighborLimit = MAX_GRAPH_NEIGHBORS,
) {
  const selectedId = `file:${selectedFile}`;
  const currentEdges = snapshot?.edges.filter(isImportEdge) ?? [];
  const previousEdges = beforeSnapshot?.edges.filter(isImportEdge) ?? [];
  const added = new Set(diff?.addedEdges ?? []);
  const removed = new Set(diff?.removedEdges ?? []);
  const relevantCurrent = currentEdges.filter((edge) => edge.from === selectedId || edge.to === selectedId);
  const relevantRemoved = previousEdges.filter((edge) => removed.has(edge.id) && (edge.from === selectedId || edge.to === selectedId));
  const allEdges: DepEdge[] = [
    ...relevantCurrent.map((edge): DepEdge => ({ ...edge, status: added.has(edge.id) ? "added" : "stable" })),
    ...relevantRemoved.map((edge): DepEdge => ({ ...edge, status: "removed" })),
  ];
  const ids = new Set<string>([selectedId]);
  for (const edge of allEdges) {
    ids.add(edge.from);
    ids.add(edge.to);
  }

  const pathById = new Map<string, string>();
  for (const node of [...(snapshot?.nodes ?? []), ...(beforeSnapshot?.nodes ?? [])]) {
    if (node.type === "file" && ids.has(node.id)) {
      pathById.set(node.id, node.path);
    }
  }

  const incoming = rankNeighbors(
    [...ids].filter((id) => id !== selectedId && allEdges.some((edge) => edge.from === id && edge.to === selectedId)),
    allEdges,
    pathById,
  );
  const outgoing = rankNeighbors(
    [...ids].filter((id) => id !== selectedId && allEdges.some((edge) => edge.from === selectedId && edge.to === id)),
    allEdges,
    pathById,
  );
  const visibleIncoming = incoming.slice(0, visibleNeighborLimit);
  const visibleOutgoing = outgoing.slice(0, visibleNeighborLimit);
  const visibleIds = new Set([selectedId, ...visibleIncoming.map((item) => item.id), ...visibleOutgoing.map((item) => item.id)]);
  const edges = allEdges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  const nodes = new Map<string, DepNodePlacement>();
  placeColumn(nodes, visibleIncoming.map((item) => item.id), pathById, "incoming");
  nodes.set(selectedId, { id: selectedId, path: selectedFile, column: "selected", index: 0, total: 1 });
  placeColumn(nodes, visibleOutgoing.map((item) => item.id), pathById, "outgoing");

  return {
    nodes,
    edges,
    incoming,
    outgoing,
    incomingHidden: Math.max(0, incoming.length - visibleIncoming.length),
    outgoingHidden: Math.max(0, outgoing.length - visibleOutgoing.length),
  };
}

function rankNeighbors(ids: string[], edges: DepEdge[], pathById: Map<string, string>): DepNeighbor[] {
  return ids
    .map((id) => ({
      id,
      path: pathById.get(id) ?? id.replace(/^file:/, ""),
      status: statusFor(id, edges),
    }))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.path.localeCompare(b.path));
}

function statusFor(id: string, edges: DepEdge[]): DepStatus {
  const statuses = edges.filter((edge) => edge.from === id || edge.to === id).map((edge) => edge.status);
  if (statuses.includes("added")) {
    return "added";
  }
  if (statuses.includes("removed")) {
    return "removed";
  }
  return "stable";
}

function statusRank(status: DepStatus): number {
  if (status === "added") {
    return 0;
  }
  if (status === "removed") {
    return 1;
  }
  return 2;
}

function placeColumn(nodes: Map<string, DepNodePlacement>, ids: string[], pathById: Map<string, string>, column: "incoming" | "outgoing") {
  ids.forEach((id, index) => {
    nodes.set(id, {
      id,
      path: pathById.get(id) ?? id.replace(/^file:/, ""),
      column,
      index,
      total: ids.length,
    });
  });
}

function dependencyPoint(node: DepNodePlacement, width: number, height: number): { x: number; y: number } {
  const x = node.column === "incoming" ? width * 0.16 : node.column === "outgoing" ? width * 0.84 : width * 0.5;
  if (node.column === "selected") {
    return { x, y: height * 0.5 };
  }
  const margin = height * 0.14;
  const available = height - margin * 2;
  const y = margin + (available * (node.index + 1)) / (node.total + 1);
  return { x, y };
}

function isImportEdge(edge: CodeEdge): edge is ImportsEdge {
  return edge.type === "imports" && edge.resolved;
}

function cellClass(delta: number, hotspot: boolean, selected: boolean): string {
  const classes = ["cell"];
  if (delta > 0) {
    classes.push("grown");
  } else if (delta < 0) {
    classes.push("shrunk");
  } else {
    classes.push("steady");
  }
  if (hotspot) {
    classes.push("hotspot");
  }
  if (selected) {
    classes.push("selected");
  }
  return classes.join(" ");
}

function AlertTriangleMarker(props: { x: number; y: number }) {
  return (
    <g transform={`translate(${props.x} ${props.y})`} className="cell-icon">
      <path d="M8 1 L15 15 H1 Z" />
      <circle cx="8" cy="12" r="1" />
      <line x1="8" y1="5" x2="8" y2="10" />
    </g>
  );
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function basename(filePath: string): string {
  return filePath.split("/").at(-1) ?? filePath;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${formatNumber(value)}`;
  }
  return formatNumber(value);
}

function shortenMiddle(value: string, maxLength: number): string {
  if (maxLength <= 1) {
    return "…";
  }
  if (value.length <= maxLength) {
    return value;
  }
  const keep = Math.floor((maxLength - 1) / 2);
  if (keep <= 0) {
    return "…";
  }
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

function measuredLength(value: number): number {
  return Math.round(value) || 1;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState(() => viewportSize());

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => {
      const nextSize = measureElement(element);
      setSize((currentSize) =>
        currentSize.width === nextSize.width && currentSize.height === nextSize.height ? currentSize : nextSize,
      );
    };
    update();
    const frame = window.requestAnimationFrame(update);
    const interval = window.setInterval(update, 180);

    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.parentElement) {
      observer.observe(element.parentElement);
    }
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return [ref, size] as const;
}

function measureElement(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect();
  const parentRect = element.parentElement?.getBoundingClientRect();
  const viewport = viewportSize();
  return {
    width: rect.width || parentRect?.width || viewport.width,
    height: rect.height || parentRect?.height || viewport.height,
  };
}

function viewportSize(): { width: number; height: number } {
  if (typeof window === "undefined") {
    return { width: 1, height: 1 };
  }
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 1,
    height: window.innerHeight || document.documentElement.clientHeight || 1,
  };
}
