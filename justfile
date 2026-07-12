set shell := ["zsh", "-cu"]

test:
    pnpm test

typecheck:
    pnpm typecheck

build:
    pnpm build

benchmark-layout *args:
    @pnpm tsx tools/benchmark-delta-layout.ts {{ args }}

benchmark-stable:
    @pnpm bench packages/layout/src/stableNeighborhood.bench.ts

stable-vt-adapter:
    @pnpm tsx tools/stable-vt-adapter.ts

validate-repository-manifest path="research/repository-evaluation-manifest.json":
    @pnpm tsx tools/validate-repository-manifest.ts {{ path }}

collect-repository-evaluation *args:
    @pnpm tsx tools/collect-repository-evaluation.ts {{ args }}

run-repository-evaluation *args:
    @pnpm tsx tools/run-repository-evaluation.ts {{ args }}

benchmark-repository-evaluation-cost *args:
    @pnpm tsx tools/benchmark-repository-evaluation-cost.ts {{ args }}

run-repository-missingness-sensitivity:
    @pnpm tsx tools/run-repository-missingness-sensitivity.ts

dev:
    pnpm dev

worker-dev port="8787":
    pnpm --filter @sprawlens/viz build
    pnpm --filter @sprawlens/worker dev -- --port {{ port }}

worker-deploy:
    pnpm --filter @sprawlens/viz build
    pnpm --filter @sprawlens/worker run deploy
