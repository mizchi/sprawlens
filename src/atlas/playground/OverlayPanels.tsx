import { useState } from "preact/hooks";
import type { PlaygroundParams } from "./Controls.tsx";
import {
  BOUNDARY_LEVELS,
  DISPLAY_LEVELS,
  granularityOf,
  OMIT_SCOPES,
  UNAVAILABLE_LEVELS,
  type BoundaryLevel,
  type DisplayLevel,
} from "./viewConfig.ts";

/**
 * Floating map overlays split out of the main Controls panel: the camera
 * (plane tilt) sits top-right and the structural axes (boundaries / display
 * levels / scope includes) live in a left hamburger drawer. Both are toggle-
 * hidden so they don't crowd the map.
 */

const PANEL_BG = "rgba(17,21,30,0.92)";
const PANEL_INK = "#e2e8f0";
const PANEL_BORDER = "rgba(148,163,184,0.3)";
const PANEL_FONT = "Monaco, ui-monospace, Menlo, monospace";

const iconButton: Record<string, string> = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "30px",
  height: "30px",
  padding: "0",
  background: PANEL_BG,
  color: PANEL_INK,
  border: `1px solid ${PANEL_BORDER}`,
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily: PANEL_FONT,
};

const sliderRow: Record<string, string> = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "12px",
};

function DegSlider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (deg: number) => void;
}) {
  return (
    <label style={sliderRow}>
      <span style={{ width: "78px" }}>
        {props.label} {Math.round(props.value)}°
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={1}
        value={props.value}
        onInput={(e) =>
          props.onChange(Number((e.target as HTMLInputElement).value))
        }
      />
    </label>
  );
}

/** Top-right camera (plane tilt) panel; collapses to a single button. */
export function CameraPanel(props: {
  params: PlaygroundParams;
  onChange: (params: PlaygroundParams) => void;
}) {
  const [open, setOpen] = useState(true);
  const { params } = props;
  const tilt = params.tilt;
  const setTilt = (patch: Partial<PlaygroundParams["tilt"]>) =>
    props.onChange({ ...params, tilt: { ...tilt, ...patch } });
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  if (!open) {
    return (
      <button
        style={{ ...iconButton, position: "absolute", top: "8px", right: "8px", width: "auto", padding: "0 10px", gap: "8px" }}
        title="show camera"
        onClick={() => setOpen(true)}
      >
        <span>{Math.round(toDeg(tilt.theta))}°</span>
        <span style={{ opacity: 0.6 }}>{Math.round(toDeg(tilt.pitch))}°</span>
      </button>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        top: "8px",
        right: "8px",
        width: "230px",
        background: PANEL_BG,
        color: PANEL_INK,
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: "12px",
        padding: "10px 12px",
        fontFamily: PANEL_FONT,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <strong style={{ fontSize: "12px", letterSpacing: "0.04em" }}>
          camera
        </strong>
        <span style={{ marginLeft: "auto", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
          {Math.round(toDeg(tilt.theta))}° {Math.round(toDeg(tilt.pitch))}°
        </span>
        <button
          style={{ ...iconButton, width: "22px", height: "22px" }}
          title="hide camera"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>
      <label style={sliderRow}>
        <span style={{ width: "78px" }}>tilt</span>
        <input
          type="checkbox"
          checked={tilt.enabled}
          onInput={(e) =>
            setTilt({ enabled: (e.target as HTMLInputElement).checked })
          }
        />
      </label>
      {tilt.enabled ? (
        <>
          <DegSlider
            label="rotate"
            min={-180}
            max={180}
            value={toDeg(tilt.theta)}
            onChange={(d) => setTilt({ theta: toRad(d) })}
          />
          <DegSlider
            label="pitch"
            min={0}
            max={80}
            value={toDeg(tilt.pitch)}
            onChange={(d) => setTilt({ pitch: toRad(d) })}
          />
          <DegSlider
            label="lean"
            min={-60}
            max={60}
            value={toDeg(tilt.skew)}
            onChange={(d) => setTilt({ skew: toRad(d) })}
          />
          <label style={sliderRow}>
            <span style={{ width: "78px" }}>tests</span>
            <input
              type="checkbox"
              checked={tilt.tests}
              onInput={(e) =>
                setTilt({ tests: (e.target as HTMLInputElement).checked })
              }
            />
          </label>
          <label style={sliderRow}>
            <span style={{ width: "78px" }}>deps</span>
            <input
              type="checkbox"
              checked={tilt.deps}
              onInput={(e) =>
                setTilt({ deps: (e.target as HTMLInputElement).checked })
              }
            />
          </label>
          {tilt.tests || tilt.deps ? (
            <label style={sliderRow}>
              <span style={{ width: "78px" }}>gap {Math.round(tilt.gap)}</span>
              <input
                type="range"
                min={100}
                max={1000}
                step={10}
                value={tilt.gap}
                onInput={(e) =>
                  setTilt({ gap: Number((e.target as HTMLInputElement).value) })
                }
              />
            </label>
          ) : null}
          <div style={{ opacity: 0.55, fontSize: "11px" }}>
            Alt+drag the map to rotate / pitch
          </div>
        </>
      ) : null}
    </div>
  );
}

function EyeIcon(props: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
        opacity={props.on ? 1 : 0.45}
      />
      {props.on ? (
        <circle cx="8" cy="8" r="2.1" fill="currentColor" />
      ) : (
        <line x1="2.5" y1="13.5" x2="13.5" y2="2.5" stroke="currentColor" stroke-width="1.2" />
      )}
    </svg>
  );
}

const LEVEL_ROW_ORDER: (BoundaryLevel | DisplayLevel)[] = [
  "module",
  "directory",
  "file",
  "class",
  "symbol",
  "ast",
  "cfg",
];

const LEVEL_LABELS: Record<string, string> = {
  module: "modules",
  directory: "directories",
  file: "files",
  class: "classes",
  symbol: "symbols",
  ast: "AST",
  cfg: "CFG",
};

/** Left hamburger drawer: structural axes (boundaries + display + includes). */
export function LayersMenu(props: {
  params: PlaygroundParams;
  availableScopes: string[];
  onChange: (params: PlaygroundParams) => void;
}) {
  const [open, setOpen] = useState(false);
  const { params, availableScopes } = props;
  const granularity = granularityOf(params.boundaries, params.displayLevels);

  const setBoundary = (level: BoundaryLevel, on: boolean) =>
    props.onChange({
      ...params,
      boundaries: BOUNDARY_LEVELS.filter((l) =>
        l === level ? on : params.boundaries.includes(l),
      ),
    });
  const setDisplay = (level: DisplayLevel, on: boolean) =>
    props.onChange({
      ...params,
      displayLevels: DISPLAY_LEVELS.filter((l) =>
        l === level ? on : params.displayLevels.includes(l),
      ),
    });
  const displayDisabled = (level: DisplayLevel) =>
    UNAVAILABLE_LEVELS.has(level) ||
    (level === "directory" && !params.boundaries.includes("directory")) ||
    (level === "cfg" && granularity === "module");

  return (
    <>
      <button
        style={{ ...iconButton, position: "absolute", top: "8px", left: "8px", zIndex: 2 }}
        title="layers"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
          {[2, 7, 12].map((y) => (
            <line key={y} x1="1" y1={y} x2="15" y2={y} stroke="currentColor" stroke-width="1.6" />
          ))}
        </svg>
      </button>
      <div
        style={{
          position: "absolute",
          top: "0",
          left: "0",
          bottom: "0",
          width: "240px",
          background: PANEL_BG,
          color: PANEL_INK,
          borderRight: `1px solid ${PANEL_BORDER}`,
          padding: "48px 14px 14px",
          fontFamily: PANEL_FONT,
          boxSizing: "border-box",
          overflowY: "auto",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.18s ease",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", opacity: 0.6, marginBottom: "6px", letterSpacing: "0.06em" }}>
            LAYERS — boundary · eye = shown
          </div>
          {LEVEL_ROW_ORDER.map((level) => {
            const isBoundary = (BOUNDARY_LEVELS as readonly string[]).includes(level);
            const isDisplay = (DISPLAY_LEVELS as readonly string[]).includes(level);
            const boundaryOn = params.boundaries.includes(level as BoundaryLevel);
            const displayOn = params.displayLevels.includes(level as DisplayLevel);
            const eyeDisabled = isDisplay && displayDisabled(level as DisplayLevel);
            return (
              <div
                key={level}
                style={{ display: "flex", alignItems: "center", gap: "8px", height: "26px", fontSize: "12px" }}
              >
                {isBoundary ? (
                  <input
                    type="checkbox"
                    title="partition boundary"
                    checked={boundaryOn}
                    onInput={(e) =>
                      setBoundary(level as BoundaryLevel, (e.target as HTMLInputElement).checked)
                    }
                  />
                ) : (
                  <span style={{ width: "13px" }} />
                )}
                <span style={{ flex: 1 }}>{LEVEL_LABELS[level]}</span>
                {isDisplay ? (
                  <button
                    title={eyeDisabled ? "unavailable" : displayOn ? "shown" : "hidden"}
                    disabled={eyeDisabled}
                    onClick={() => setDisplay(level as DisplayLevel, !displayOn)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: PANEL_INK,
                      cursor: eyeDisabled ? "default" : "pointer",
                      opacity: eyeDisabled ? 0.3 : 1,
                      padding: "2px",
                      display: "flex",
                    }}
                  >
                    <EyeIcon on={displayOn} />
                  </button>
                ) : (
                  <span style={{ width: "20px" }} />
                )}
              </div>
            );
          })}
        </div>
        <div>
          <div style={{ fontSize: "11px", opacity: 0.6, marginBottom: "6px", letterSpacing: "0.06em" }}>
            INCLUDE
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {OMIT_SCOPES.map((scope) => (
              <label key={scope} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                <input
                  type="checkbox"
                  checked={!params.omit.includes(scope)}
                  onInput={(e) => {
                    const shown = (e.target as HTMLInputElement).checked;
                    props.onChange({
                      ...params,
                      omit: OMIT_SCOPES.filter((s) =>
                        s === scope ? !shown : params.omit.includes(s),
                      ),
                    });
                  }}
                />
                {scope}
              </label>
            ))}
            {availableScopes.map((scope) => (
              <label key={scope} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                <input
                  type="checkbox"
                  checked={!params.omitModules.includes(scope)}
                  onInput={(e) => {
                    const shown = (e.target as HTMLInputElement).checked;
                    props.onChange({
                      ...params,
                      omitModules: shown
                        ? params.omitModules.filter((m) => m !== scope)
                        : [...params.omitModules, scope],
                    });
                  }}
                />
                {scope}
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
