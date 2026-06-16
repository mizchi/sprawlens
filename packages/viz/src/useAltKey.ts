import { useEffect, useState } from "preact/hooks";

/**
 * Whether the Alt key is currently held. A window blur resets it so a missed
 * keyup can't leave it stuck on. Host/DOM glue — the viz uses it to reveal every
 * cross-layer edge at once (the default is hover-gated).
 */
export function useAltKey(): boolean {
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    const sync = (e: KeyboardEvent) => setAlt(e.altKey);
    const clear = () => setAlt(false);
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", clear);
    };
  }, []);
  return alt;
}
