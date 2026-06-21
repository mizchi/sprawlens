/**
 * Normalize a serialized `<svg>` for snapshotting: round every decimal to one
 * place so sub-pixel float jitter (seeded but arch-sensitive transcendental
 * math) doesn't cause spurious diffs across machines. Integers are left alone.
 * The layout is deterministic on a fixed seed, so the normalized SVG is a
 * stable fingerprint of the render — any real change to structure / attrs /
 * geometry shows up, refactor-noise doesn't.
 */
export function normalizeSvg(svg: string): string {
  return svg.replace(/-?\d+\.\d+/g, (n) => Number(n).toFixed(1));
}
