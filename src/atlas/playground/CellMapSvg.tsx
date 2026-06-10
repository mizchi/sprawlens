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
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/** Error heat: white near 0, red as |relative error| approaches 30%. */
function cellFill(targetArea: number, actualArea: number): string {
  const error = Math.abs(actualArea - targetArea) / targetArea;
  const t = Math.min(error / 0.3, 1);
  const hue = 215 - t * 215; // calm blue → red
  return `hsl(${hue} ${30 + t * 60}% ${88 - t * 30}%)`;
}

export function CellMapSvg(props: Props) {
  const {
    state,
    edges,
    showEdges,
    innerCells,
    labels,
    width,
    height,
    selectedId,
    onSelect,
  } = props;
  const siteById = new Map(state.cells.map((c) => [c.id, c.site]));
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
              fill={cellFill(cell.targetArea, cell.actualArea)}
              stroke={cell.id === selectedId ? "#1d4ed8" : "#475569"}
              stroke-width={cell.id === selectedId ? 2.5 : 0.75}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(cell.id);
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
              r={cell.id === selectedId ? 5 : 2.5}
              fill={cell.id === selectedId ? "#1d4ed8" : "#1e293b"}
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
