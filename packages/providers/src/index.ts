import type { LanguageProvider } from "@sprawlens/contracts";
import { tsProvider } from "@sprawlens/analyzer-ts";
import { goProvider } from "@sprawlens/analyzer-go";
import { rustProvider } from "@sprawlens/analyzer-rust";
import { moonbitProvider } from "@sprawlens/analyzer-moonbit";

// @sprawlens/providers — the language provider registry. The match order puts
// language-specific signals (go.mod, Cargo.toml, moon.mod.json) before the
// broad TypeScript fallback, which also claims any package.json / tsconfig.json.
export const PROVIDERS: LanguageProvider[] = [
  goProvider,
  rustProvider,
  moonbitProvider,
  tsProvider,
];

export { detectProviders } from "@sprawlens/contracts";
