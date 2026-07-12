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

benchmark-repository-condition-memory:
    @pnpm tsx tools/benchmark-repository-condition-memory.ts

experiment-stable-visual:
    pnpm --filter @sprawlens/viz build
    pnpm tsx tools/run-stable-visual-experiment.ts

evaluate-ast-diff-gold *args:
    @pnpm tsx tools/evaluate-ast-symbol-diff.ts {{ args }}

prepare-ast-diff-annotations *args:
    @pnpm tsx tools/prepare-ast-diff-annotation-packets.ts {{ args }}

check-ast-diff-confirmatory-freeze:
    @pnpm tsx tools/check-ast-diff-freeze.ts

evaluate-ast-diff-confirmatory: check-ast-diff-confirmatory-freeze
    @pnpm tsx tools/evaluate-ast-symbol-diff.ts --manifest research/ast-diff-confirmatory-annotation.json --gold research/datasets/ast-diff-confirmatory-v1-phase1.json --output research/results/ast-diff-confirmatory-v1-phase1-report.json --markdown research/results/ast-diff-confirmatory-v1-phase1-report.md

prepare-ast-diff-extraction-v2:
    @pnpm tsx tools/extend-ast-diff-annotation.ts
    @pnpm tsx tools/prepare-ast-diff-annotation-packets.ts research/ast-diff-confirmatory-candidates.json research/annotation-packets/ast-diff-extraction-v2 ast-diff-extraction-v2-posthoc posthoc

evaluate-ast-diff-extraction-v2:
    @pnpm tsx tools/check-ast-diff-freeze.ts research/ast-diff-extraction-v2-freeze.json
    @pnpm tsx tools/evaluate-ast-symbol-diff.ts --manifest research/ast-diff-extraction-v2-annotation.json --gold research/datasets/ast-diff-extraction-v2-posthoc.json --output research/results/ast-diff-extraction-v2-posthoc-report.json --markdown research/results/ast-diff-extraction-v2-posthoc-report.md

prepare-ast-diff-registration-v3:
    @pnpm tsx tools/extend-ast-diff-annotation.ts research/ast-diff-extraction-v2-annotation.json research/ast-diff-registration-v3-extension.json research/ast-diff-registration-v3-annotation.json
    @pnpm tsx tools/prepare-ast-diff-annotation-packets.ts research/ast-diff-confirmatory-candidates.json research/annotation-packets/ast-diff-registration-v3 ast-diff-registration-v3-posthoc posthoc

evaluate-ast-diff-registration-v3:
    @pnpm tsx tools/check-ast-diff-freeze.ts research/ast-diff-registration-v3-freeze.json
    @pnpm tsx tools/evaluate-ast-symbol-diff.ts --manifest research/ast-diff-registration-v3-annotation.json --gold research/datasets/ast-diff-registration-v3-posthoc.json --output research/results/ast-diff-registration-v3-posthoc-report.json --markdown research/results/ast-diff-registration-v3-posthoc-report.md

compare-ast-diff-variants:
    @pnpm tsx tools/compare-ast-diff-variants.ts

experiment-ast-diff-render:
    pnpm perf:ast-diff-render

dev:
    pnpm dev

worker-dev port="8787":
    pnpm --filter @sprawlens/viz build
    pnpm --filter @sprawlens/worker dev -- --port {{ port }}

worker-deploy:
    pnpm --filter @sprawlens/viz build
    pnpm --filter @sprawlens/worker run deploy
