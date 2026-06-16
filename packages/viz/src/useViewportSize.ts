import { useEffect, useRef, useState } from "preact/hooks";

export type Size = { width: number; height: number };

/**
 * Track a container's pixel size via ResizeObserver, debounced (resizes re-solve
 * the layout, so collapse a drag into one update). Returns the measured `size`,
 * a `sizeRef` mirror for callbacks/solvers that read outside render, and the
 * `ref` to attach to the container. This is host/DOM glue — kept out of the
 * engine so a non-DOM renderer supplies its own extent.
 */
export function useViewportSize(
  initial: Size,
  min: Size = { width: 320, height: 240 },
) {
  const [size, setSize] = useState(initial);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let timer = 0;
    const apply = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(min.width, Math.round(rect.width));
      const height = Math.max(min.height, Math.round(rect.height));
      setSize((prev) =>
        Math.abs(prev.width - width) < 2 && Math.abs(prev.height - height) < 2
          ? prev
          : { width, height },
      );
    };
    apply();
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(apply, 250);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { size, sizeRef, ref };
}
