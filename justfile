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

benchmark-ast-diff-scaling profile="pilot" *args:
    @pnpm tsx tools/run-ast-diff-scaling-benchmark.ts --profile {{ profile }} {{ args }}

calibrate-ast-diff-adaptive-threshold *args:
    @pnpm tsx tools/calibrate-ast-diff-adaptive-threshold-result.ts {{ args }}

assess-ast-diff-adaptive-validation *args:
    @pnpm tsx tools/assess-ast-diff-adaptive-validation-result.ts {{ args }}

analyze-ast-diff-adaptive-compatibility *args:
    @pnpm tsx tools/analyze-ast-diff-adaptive-compatibility.ts {{ args }}

build-ast-diff-repository-fixture *args:
    @pnpm tsx tools/build-ast-diff-repository-fixture.ts {{ args }}

select-ast-diff-performance-holdout *args:
    @pnpm tsx tools/select-ast-diff-performance-holdout.ts {{ args }}

benchmark-ast-diff-repository profile="smoke" *args:
    @pnpm tsx tools/run-ast-diff-repository-benchmark.ts --profile {{ profile }} {{ args }}

experiment-stable-visual:
    pnpm --filter @sprawlens/viz build
    pnpm tsx tools/run-stable-visual-experiment.ts

evaluate-ast-diff-gold *args:
    @pnpm tsx tools/evaluate-ast-symbol-diff.ts {{ args }}

prepare-ast-diff-annotations *args:
    @pnpm tsx tools/prepare-ast-diff-annotation-packets.ts {{ args }}

select-ast-diff-confirmatory-v2:
    @pnpm tsx tools/select-ast-diff-holdout.ts

prepare-ast-diff-confirmatory-v2: select-ast-diff-confirmatory-v2
    @pnpm tsx tools/prepare-ast-diff-annotation-packets.ts research/ast-diff-confirmatory-v2-candidates.json research/annotation-packets/ast-diff-confirmatory-v2 ast-diff-confirmatory-v2-holdout

check-ast-diff-confirmatory-v2-preannotation:
    @pnpm tsx tools/check-ast-diff-freeze.ts research/ast-diff-confirmatory-v2-preannotation-freeze.json

prepare-ast-diff-confirmatory-v2-solo:
    @pnpm tsx tools/prepare-solo-ast-diff-annotation.ts

freeze-ast-diff-confirmatory-v2-solo-preannotation:
    @pnpm tsx tools/freeze-solo-ast-diff-preannotation.ts

check-ast-diff-confirmatory-v2-solo-preannotation:
    @pnpm tsx tools/check-ast-diff-freeze.ts research/ast-diff-confirmatory-v2-solo-preannotation-freeze.json

annotate-ast-diff-confirmatory-v2-solo-pass-a port="4317":
    @pnpm tsx tools/serve-solo-ast-diff-annotation.ts --pass A --port {{ port }}

test-ast-diff-confirmatory-v2-solo-annotation-ui:
    @pnpm test:ast-diff-annotation

lock-ast-diff-confirmatory-v2-solo-pass-a:
    @pnpm tsx tools/lock-solo-ast-diff-annotation-pass.ts --pass A

start-ast-diff-confirmatory-v2-solo-pass-b:
    @pnpm tsx tools/check-ast-diff-freeze.ts research/ast-diff-confirmatory-v2-solo-pass-a-lock.json
    @pnpm tsx tools/prepare-solo-ast-diff-annotation.ts --initialize-pass B

lock-ast-diff-confirmatory-v2-solo-pass-b:
    @pnpm tsx tools/lock-solo-ast-diff-annotation-pass.ts --pass B

compare-ast-diff-confirmatory-v2-solo:
    @pnpm tsx tools/check-ast-diff-freeze.ts research/ast-diff-confirmatory-v2-solo-pass-a-lock.json
    @pnpm tsx tools/check-ast-diff-freeze.ts research/ast-diff-confirmatory-v2-solo-pass-b-lock.json
    @pnpm tsx tools/compare-solo-ast-diff-annotations.ts

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

compare-ast-diff-baselines:
    @pnpm tsx tools/compare-ast-diff-baselines.ts

preview-change-localization-study:
    @pnpm tsx tools/generate-change-localization-study-plan.ts

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
