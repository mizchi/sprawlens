import { useEffect, useRef } from "preact/hooks";
import type { PlaygroundParams } from "./Controls.tsx";

/**
 * Keep `params.dark` in sync with the OS color scheme — until the user takes
 * manual control, which then pins the theme until reload. Returns a params-edit
 * wrapper that records a manual dark toggle as the override. Host/DOM glue
 * (matchMedia); the engine just consumes the resulting `params.dark`.
 */
export function useColorScheme(
  setParams: (updater: (prev: PlaygroundParams) => PlaygroundParams) => void,
  currentDark: () => boolean,
) {
  const overridden = useRef(false);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onSchemeChange = (event: MediaQueryListEvent) => {
      if (overridden.current) return;
      setParams((prev) =>
        prev.dark === event.matches ? prev : { ...prev, dark: event.matches },
      );
    };
    query.addEventListener("change", onSchemeChange);
    return () => query.removeEventListener("change", onSchemeChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Wrap a params edit so a manual dark toggle pins the theme. */
  const onParamsChange = (next: PlaygroundParams) => {
    if (next.dark !== currentDark()) overridden.current = true;
    setParams(() => next);
  };
  return { onParamsChange };
}
