import { useRef, useState } from "preact/hooks";
import type { AtlasEdge } from "../contracts/graph.js";
import type { CellResult } from "../kernel/capacityLayout.js";
import type { Vec2 } from "../kernel/vec.js";
import type { RingsState } from "./ringsController.ts";

type Props = {
  rings: RingsState;
  innerCells: CellResult[];
  fileEdges: AtlasEdge[];
  showEdges: boolean;
  labels: Map<string, string>;
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

function cellFill(targetArea: number, actualArea: number): string {
  const error = Math.abs(actualArea - targetArea) / targetArea;
  const t = Math.min(error / 0.3, 1);
  const hue = 215 - t * 215;
  return `hsl(${hue} ${30 + t * 60}% ${88 - t * 30}%)`;
}

type ViewBox = { x: number; y: number; w: number; h: number };

export function RingsMapSvg(props: Props) {
  const {
    rings,
    innerCells,
    fileEdges,
    showEdges,
    labels,
    width,
    height,
    selectedId,
    onSelect,
  } = props;
  const [view, setView] = useState<ViewBox>({ x: 0, y: 0, w: width, h: height });
  const dragRef = useRef<{ pointerId: number; last: Vec2 } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const toViewScale = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? view.w / rect.width : 1;
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = Math.exp(event.deltaY * 0.0018);
    setView((v) => {
      const newW = Math.min(Math.max(v.w * factor, width / 40), width * 3);
      const scale = newW / v.w;
      const px = v.x + ((event.clientX - rect.left) / rect.width) * v.w;
      const py = v.y + ((event.clientY - rect.top) / rect.height) * v.h;
      return {
        x: px - (px - v.x) * scale,
        y: py - (py - v.y) * scale,
        w: newW,
        h: v.h * scale,
      };
    });
  };

  const fileCells = [...rings.moduleLayouts.values()].flatMap((l) => l.cells);
  const siteById = new Map(fileCells.map((c) => [c.id, c.site]));
  const moduleList = [...rings.circles.entries()];

  // hide nested symbols / file labels while zoomed far out (cheap LOD)
  const zoom = width / view.w;
  const showInner = zoom > 0.8;

  return (
    <svg
      ref={svgRef}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        touchAction: "none",
        cursor: "grab",
      }}
      onClick={() => onSelect(null)}
      onWheel={onWheel}
      onPointerDown={(e) => {
        dragRef.current = {
          pointerId: e.pointerId,
          last: { x: e.clientX, y: e.clientY },
        };
        (e.target as Element).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const scale = toViewScale();
        setView((v) => ({
          ...v,
          x: v.x - (e.clientX - drag.last.x) * scale,
          y: v.y - (e.clientY - drag.last.y) * scale,
        }));
        drag.last = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
      }}
    >
      {/* aggregated module dependencies, under everything */}
      <g stroke="#475569" fill="none">
        {rings.moduleEdges.map((edge) => {
          const a = rings.circles.get(edge.source);
          const b = rings.circles.get(edge.target);
          if (!a || !b) return null;
          return (
            <line
              key={`${edge.source}->${edge.target}`}
              x1={a.cx}
              y1={a.cy}
              x2={b.cx}
              y2={b.cy}
              stroke-width={1 + Math.log2(1 + (edge.weight ?? 1))}
              stroke-opacity={0.35}
            />
          );
        })}
      </g>
      <g>
        {moduleList.map(([id, circle]) => (
          <circle
            key={id}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            fill="#eef2f7"
            stroke="#334155"
            stroke-width={1.2}
          />
        ))}
      </g>
      <g>
        {fileCells.map((cell) =>
          cell.polygon.length >= 3 ? (
            <polygon
              key={cell.id}
              points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={cellFill(cell.targetArea, cell.actualArea)}
              stroke={cell.id === selectedId ? "#1d4ed8" : "#475569"}
              stroke-width={cell.id === selectedId ? 2 : 0.6}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(cell.id);
              }}
            />
          ) : null,
        )}
      </g>
      {showInner ? (
        <g fill="none" stroke="#64748b" stroke-width={0.35} stroke-opacity={0.8}>
          {innerCells.map((cell) =>
            cell.polygon.length >= 3 ? (
              <polygon
                key={cell.id}
                points={cell.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              />
            ) : null,
          )}
        </g>
      ) : null}
      {showEdges ? (
        <g stroke="#f97316" stroke-opacity={0.4} fill="none">
          {fileEdges.map((edge) => {
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
                    ? 1.6
                    : 0.5
                }
              />
            );
          })}
        </g>
      ) : null}
      <g fill="#1e293b">
        {fileCells.map((cell) =>
          cell.polygon.length >= 3 ? (
            <circle
              key={cell.id}
              cx={cell.site.x}
              cy={cell.site.y}
              r={cell.id === selectedId ? 3.5 : 1.6}
              fill={cell.id === selectedId ? "#1d4ed8" : "#1e293b"}
            />
          ) : null,
        )}
      </g>
      <g
        text-anchor="middle"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {moduleList.map(([id, circle]) => (
          <text
            key={id}
            x={circle.cx}
            y={circle.cy - circle.r - 4}
            font-size={Math.max(circle.r * 0.18, 10)}
            font-weight="600"
            fill="#0f172a"
          >
            {id}
          </text>
        ))}
        {showInner
          ? fileCells.map((cell) => {
              if (cell.polygon.length < 3) return null;
              const fontSize = Math.sqrt(cell.actualArea) * 0.18;
              if (fontSize * zoom < 8 && cell.id !== selectedId) return null;
              return (
                <text
                  key={cell.id}
                  x={cell.site.x}
                  y={cell.site.y - 4}
                  font-size={Math.max(fontSize, 6)}
                  fill="#334155"
                >
                  {labels.get(cell.id) ?? cell.id}
                </text>
              );
            })
          : null}
      </g>
    </svg>
  );
}
