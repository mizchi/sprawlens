import type { ComponentChildren } from "preact";
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

const GITHUB_URL = "https://github.com/mizchi/sprawlens";

function DarkButton(props: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      style={iconButton}
      title={props.dark ? "switch to light" : "switch to dark"}
      onClick={props.onToggle}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        {props.dark ? (
          <path
            d="M11 8a3 3 0 1 1-3.6-2.94A4 4 0 1 0 11 8Z"
            fill="currentColor"
          />
        ) : (
          <>
            <circle cx="8" cy="8" r="3" fill="currentColor" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
              const r = (a * Math.PI) / 180;
              return (
                <line
                  key={a}
                  x1={8 + Math.cos(r) * 5}
                  y1={8 + Math.sin(r) * 5}
                  x2={8 + Math.cos(r) * 6.5}
                  y2={8 + Math.sin(r) * 6.5}
                  stroke="currentColor"
                  stroke-width="1.3"
                />
              );
            })}
          </>
        )}
      </svg>
    </button>
  );
}

function GithubLink() {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      title="source on GitHub"
      style={{ ...iconButton, textDecoration: "none" }}
    >
      <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
        />
      </svg>
    </a>
  );
}

/** Top-right cluster: camera (tilt) panel — collapsed by default — alongside
 * the dark-mode toggle and a GitHub link in the far corner. */
export function CameraPanel(props: {
  params: PlaygroundParams;
  onChange: (params: PlaygroundParams) => void;
}) {
  const [open, setOpen] = useState(false);
  const { params } = props;
  const tilt = params.tilt;
  const setTilt = (patch: Partial<PlaygroundParams["tilt"]>) =>
    props.onChange({ ...params, tilt: { ...tilt, ...patch } });
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  return (
    <div
      style={{
        position: "absolute",
        top: "8px",
        right: "8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          style={{
            ...iconButton,
            width: "auto",
            padding: "0 10px",
            gap: "6px",
            fontSize: "12px",
            fontVariantNumeric: "tabular-nums",
          }}
          title={open ? "hide camera" : "camera / tilt"}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{Math.round(toDeg(tilt.theta))}°</span>
          <span style={{ opacity: 0.6 }}>{Math.round(toDeg(tilt.pitch))}°</span>
        </button>
        <DarkButton
          dark={params.dark}
          onToggle={() => props.onChange({ ...params, dark: !params.dark })}
        />
        <GithubLink />
      </div>
      {open ? (
        <div
          style={{
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
            <span style={{ width: "78px" }}>gap {tilt.gap.toFixed(2)}×</span>
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.05}
              value={tilt.gap}
              onInput={(e) =>
                setTilt({ gap: Number((e.target as HTMLInputElement).value) })
              }
            />
          </label>
          <div style={{ opacity: 0.55, fontSize: "11px" }}>
            Alt+drag the map to rotate / pitch
          </div>
        </>
          ) : (
            <div style={{ opacity: 0.55, fontSize: "11px" }}>
              enable a layer (tests / deps) on the left to tilt
            </div>
          )}
        </div>
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
  /** View options (data / preset / layout / …) rendered as a trailing section. */
  children?: ComponentChildren;
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

  // selecting a satellite plane (2+ layers incl. source) auto-tilts the view;
  // turning all of them off (source alone) lays it flat again
  const setPlane = (key: "tests" | "deps", on: boolean) => {
    const tests = key === "tests" ? on : params.tilt.tests;
    const deps = key === "deps" ? on : params.tilt.deps;
    props.onChange({
      ...params,
      tilt: { ...params.tilt, tests, deps, enabled: tests || deps },
    });
  };

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
            PLANES — stack below source
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "26px", fontSize: "12px", opacity: 0.5 }}>
            <span style={{ width: "13px" }} />
            <span style={{ flex: 1 }}>source</span>
          </div>
          {(["tests", "deps"] as const).map((plane) => (
            <label
              key={plane}
              style={{ display: "flex", alignItems: "center", gap: "8px", height: "26px", fontSize: "12px", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={params.tilt[plane]}
                onInput={(e) =>
                  setPlane(plane, (e.target as HTMLInputElement).checked)
                }
              />
              <span style={{ flex: 1 }}>{plane}</span>
            </label>
          ))}
        </div>
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
        {props.children ? (
          <div>
            <div style={{ fontSize: "11px", opacity: 0.6, marginBottom: "6px", letterSpacing: "0.06em" }}>
              VIEW
            </div>
            {props.children}
          </div>
        ) : null}
      </div>
    </>
  );
}
