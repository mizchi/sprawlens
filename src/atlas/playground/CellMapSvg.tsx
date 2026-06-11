import type { AtlasEdge } from "../contracts/graph.js";
import type {
  CapacityLayoutState,
  CellResult,
} from "../kernel/capacityLayout.js";

type Props = {
  state: CapacityLayoutState;
  edges: AtlasEdge[];
  showEdges: boolean;
  innerCells: CellResult[];
  /** Display label per cell id; falls back to the id. */
  labels?: Map<string, string>;
  /** Working-tree diff: changed cells override the error-heat fill. */
  changedFiles?: Map<string, "added" | "modified">;
  width: number;
  height: number;
  selectedId: string | null;
  /** Full multi-selection (shift+click); selectedId is its primary. */
  selectedIds?: Set<string>;
  onSelect: (id: string | null, additive?: boolean) => void;
};

/** Error heat: white near 0, red as |relative error| approaches 30%. */
function cellFill(targetArea: number, actualArea: number): string {
  const error = Math.abs(actualArea - targetArea) / targetArea;
  const t = Math.min(error / 0.3, 1);
  const hue = 215 - t * 215; // calm blue → red
  return `hsl(${hue} ${30 + t * 60}% ${88 - t * 30}%)`;
}

const MODIFIED_FILL = "hsl(8 85% 78%)";
const ADDED_FILL = "hsl(150 55% 80%)";

export function CellMapSvg(props: Props) {
  const {
    state,
    edges,
    showEdges,
    innerCells,
    labels,
    changedFiles,
    width,
    height,
    selectedId,
    onSelect,
  } = props;
  const siteById = new Map(state.cells.map((c) => [c.id, c.site]));
  const multiSelected = props.selectedIds ?? new Set<string>();
  const isSelected = (id: string): boolean =>
    id === selectedId || multiSelected.has(id);
  const fillOf = (cell: CellResult) => {
    const changed = changedFiles?.get(cell.id);
    if (changed === "added") return ADDED_FILL;
    if (changed === "modified") return MODIFIED_FILL;
    return cellFill(cell.targetArea, cell.actualArea);
  };
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "100%", display: "block" }}
      onClick={() => onSelect(null)}
    >
      <g>
        {state.cells.map((cell) =>
          cell.polygon.length >= 3 ? (
            <polygon
              key={cell.id}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={fillOf(cell)}
              stroke={isSelected(cell.id) ? "#1d4ed8" : "#475569"}
              stroke-width={isSelected(cell.id) ? 2.5 : 0.75}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(cell.id, event.shiftKey);
              }}
            />
          ) : null,
        )}
      </g>
      <g fill="none" stroke="#64748b" stroke-width={0.45} stroke-opacity={0.8}>
        {innerCells.map((cell) =>
          cell.polygon.length >= 3 ? (
            <polygon
              key={cell.id}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          ) : null,
        )}
      </g>
      {showEdges ? (
        <g stroke="#f97316" stroke-opacity={0.45} fill="none">
          {edges.map((edge) => {
            const a = siteById.get(edge.source);
            const b = siteById.get(edge.target);
            if (!a || !b) return null;
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke-width={
                  edge.source === selectedId || edge.target === selectedId
                    ? 2
                    : 0.6
                }
              />
            );
          })}
        </g>
      ) : null}
      <g fill="#1e293b">
        {state.cells.map((cell) =>
          cell.polygon.length >= 3 ? (
            <circle
              key={cell.id}
              cx={cell.site.x}
              cy={cell.site.y}
              r={isSelected(cell.id) ? 5 : 2.5}
              fill={isSelected(cell.id) ? "#1d4ed8" : "#1e293b"}
            />
          ) : null,
        )}
      </g>
      <g
        fill="#334155"
        text-anchor="middle"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {state.cells.map((cell) => {
          if (cell.polygon.length < 3) return null;
          // label only cells large enough to host readable text
          const fontSize = Math.sqrt(cell.actualArea) * 0.16;
          if (fontSize < 7 && cell.id !== selectedId) return null;
          return (
            <text
              key={cell.id}
              x={cell.site.x}
              y={cell.site.y - 6}
              font-size={Math.max(fontSize, 9)}
              font-weight={cell.id === selectedId ? "700" : "400"}
            >
              {labels?.get(cell.id) ?? cell.id}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
