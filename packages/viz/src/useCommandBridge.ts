import { useEffect, useRef } from "preact/hooks";
import type { VizCommand } from "./vizCommands.ts";

/**
 * Expose the viz command registry two ways:
 *   - WebMCP tools via `navigator.modelContext.registerTool`, so an LLM agent
 *     in the page can drive the map (feature-detected; a no-op where absent).
 *   - keybindings, so a human gets the same operations.
 * `commands` is rebuilt every render so the tools/keys invoke fresh state;
 * registration itself happens once.
 */
type ModelContext = {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
  }) => { unregister?: () => void } | void;
};

const EMPTY_SCHEMA = { type: "object", properties: {} };

function keyFromEvent(e: KeyboardEvent): string | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return null;
  return e.key;
}

export function useCommandBridge(commands: VizCommand[]): void {
  const commandsRef = useRef<VizCommand[]>([]);
  commandsRef.current = commands;

  // keybindings
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = keyFromEvent(e);
      if (key === null) return;
      const cmd = commandsRef.current.find((c) => c.keys?.includes(key));
      if (cmd) {
        e.preventDefault();
        cmd.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // WebMCP tools
  useEffect(() => {
    const mc = (navigator as unknown as { modelContext?: ModelContext }).modelContext;
    if (!mc?.registerTool) return;
    const regs = commandsRef.current.map((c) =>
      mc.registerTool({
        name: c.id,
        description: c.title,
        inputSchema: c.inputSchema ?? EMPTY_SCHEMA,
        execute: async (args) => {
          // resolve by id so the latest closure (fresh state) runs
          const live = commandsRef.current.find((x) => x.id === c.id) ?? c;
          const result = await live.run(args);
          const text = typeof result === "string" ? result : JSON.stringify(result ?? "ok");
          return { content: [{ type: "text", text }] };
        },
      }),
    );
    return () => {
      for (const r of regs) r?.unregister?.();
    };
  }, []);
}
