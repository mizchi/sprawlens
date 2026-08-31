# 隣接研究から派生する形式化テーマ

この文書は、既存の証明済み結果と、今後の研究仮説を混同しないための台帳である。番号は研究候補の整理時に用いた番号に対応する。

## 1. 状態依存レイアウトの合流性欠損

### 問いたいこと

同じ入力graphへ到達する独立編集列でも、前状態を参照するlayout transitionの終点は一致するとは限らない。編集`A`と`B`の局所squareについて、`T_B (T_A L) = T_A (T_B L)`となる条件を特徴づけ、成立しない場合は差を合流性欠損として測る。

### 現在証明できたこと

- `ControlledPaths`でweight変更とleaf追加、weight変更とrewireが入力graph上で可換である。
- `LayoutConfluence`で、独立編集の全局所squareがlayout状態上でも可換なら、隣接する独立編集の交換で結ばれた任意の編集列は同じlayout終点を持つことを証明した。
- `ControlledPathConfluence`で三種類のcontrolled editを共通の編集言語へ埋め込み、既存の局所可換性から、独立swapで結ばれた任意長の編集列が同じ入力graph終点を持つことを証明した。
- 一つの非可換squareが、最小のpath-dependence witnessになることを証明した。
- resetとflipだけからなる二状態modelで、同じ二編集が順序により異なる終点を持つload-bearing counterexampleを固定した。
- `HistorySelectorConfluence`で、二候補・二編集・前状態への距離最小という有限selectorを定義した。AB/BAは同じ入力終点を持つ一方、中間状態で一意に選ばれた候補が共通終点のtie-breakとして残るため、最終geometryが異なることを証明した。
- `ConfluenceDefect`で局所squareの二終点間距離を欠損として定義した。metric spaceでは欠損0とその状態での可換性が同値であり、第二遷移のLipschitz定数と二つのstep budgetから欠損上界が得られることを証明した。

### 未証明・実証が必要なこと

- 実際のSprawlens layout transitionがどの編集対で可換になるか。
- 非可換性を距離へ持ち上げた上界、下界、またはLipschitz条件。
- 実geometry metricについてLipschitz定数とstep budgetを推定・保証すること。
- reversal residualと局所squareの欠損を結ぶ定理。
- 今回の二候補witnessが、実repository sequenceの候補生成・feasible-envelope metricに埋め込めること。

新規性は可換性の一般代数ではなく、状態依存visual layoutのpath dependenceを局所squareと証明可能な欠損へ分解する点に置く。

### 2026-08-31 実装・視覚checkpoint

- LeanとTypeScriptが共有する9ケースのfixtureを追加した。TypeScript側はproductionの`selectVectorFeasibleEnvelope`を使い、二つの2D candidate siteへのEuclidean predecessor displacementをselection costとする。全caseでLeanの有限selectorと同じ選択になった。
- Sprawlens履歴fixtureの通常表示を24 commits・23 transitionsで再実行した。contract violationは0、変位が改善したtransitionは15、stable group updateあたりの平均変位改善は`0.2035587466`、平均adjacency gainは`0`だった。
- 既存controlled-sequence development artifactでは、11 repositories・75 seed-evaluated probesでproduction `stableNeighborhood`のAB/BA boundary defectが平均`0.0374063`、95% CI `[0.0013804, 0.0734323]`だった。history-free対照`neighborhoodSwap`は実質0であり、有限selectorの非可換構造と整合する。ただしこれはpost-hoc evidenceである。
- best transitionの変位改善は`0.4945880595`で、2候補ともeligible、baseline selectionは0だった。大きなmodule領域の連続性は視覚的に保たれた一方、`core`上部の高密度symbol labelには重なりが残る。これは合流性ではなく表示密度の別問題として扱う。
- module-only表示では最初のtransitionを測定後、次のlayoutが30秒以内にconvergeせずtimeoutした。これは形式定理への反例ではなく、実solverまたは完了判定の観測として保留する。
- 出力artifactは`preview/stable-layout-ui-benchmark/summary.json`、`before.png`、`best.png`に保存した。

## 3. 退化を含む半平面クリッピングの正準性

### 問いたいこと

半平面の適用順序を変えたとき、空・点・線分・面積を持つpolygonを統一的に扱う正規化後の出力artifactが一致するか。頂点列の完全一致が強すぎる場合は、表現する領域の一致を正本とする。

### 現在証明できたこと

- `ConvexClipConsequences`で、宣言的な点集合意味論は半平面列の任意の順列に対して不変である。
- `CanonicalClip`で、emitterが宣言的意味論にsoundで、canonicalizerが領域に対してextensionalなら、意味論上の順序独立性を正準artifactの完全一致へ持ち上げられることを証明した。
- canonicalizerの意味保存と領域extensionalityから冪等性が従うことを証明し、実canonicalizerに必要な義務を意味保存と一意性へ分離した。
- 入力polygon領域を全directed edgeの支持半平面の共通部分として定義し、weak convex inputから実`clipIndexedRing`が出力する全頂点が入力領域と新しいclip half-planeの共通部分に含まれることを証明した。
- edge emitterの出力値は、半平面内または境界上のcurrent vertexと、leaving / entering edgeの`boundaryPoint`に限られ、かつそれらを全て出力することを同値で証明した。境界endpointが両方の役割を持つ退化caseも含む。
- `destutter`とclosing duplicate除去はvalue membershipを双方向に保存する。これをedge列へ合成し、最終`clipIndexedRing`の有限頂点集合が「保持入力頂点 ∪ 全crossing交差点」とexactに一致することを証明した。この集合等号自体はconvexityを仮定しない。
- weak convexityを追加すると、その全境界生成子が入力polygon領域とclip half-planeの共通部分に入る。これにより、実emitterの有限頂点集合についてsoundnessとcompletenessの両方向が閉じた。
- 出力された任意の二頂点間のclosed segment全体を`clipIndexedChordRegion`として定義した。weak convex inputでは、その全点が入力polygon領域とclip half-planeの共通部分に入る。これは出力辺と全対角線を含む連続的なsoundnessであるが、polygon内部全体の完全性ではない。
- `Vec2Linear`で`Vec2 ≃ R × R`を介した標準線形空間構造を定義し、mathlibのaffine combinationが既存の実行可能`interpolatePoint`と一致することを証明した。幾何primitiveと連続領域の証明層は分離している。
- 出力頂点集合の`convexHull`を`clipIndexedConvexRegion`として定義した。empty・point・segment・area-bearing polygonを同じ意味論で扱え、weak convex inputではこの連続領域全体が入力polygon領域とclip half-planeの共通部分に入ることを証明した。`clipIndexedChordRegion`がこの領域の部分集合であることも証明済みである。
- weak convexityだけで逆包含を主張できない最小反例をLeanで固定した。全3頂点が同一点のcollapsed triangleはweak convex contractを満たすが、edge支持半平面は全て無制約なので`indexedPolygonRegion`は全平面になり、出力convex hullは一点になる。
- 退化安全な入力意味論として、入力頂点集合のconvex hullである`indexedVertexConvexRegion`を追加した。実emitterの全点が入力辺上にあることから、出力convex hull全体が`indexedVertexConvexRegion ∩ halfPlaneRegion`に入ることを、convexityの仮定なしで証明した。collapsed triangleでは両領域が実際に同じ一点になることもLeanで証明し、意味論の修正が反例を解消するpositive sanity caseとして保持した。
- no-cutとempty-cutの連続領域等号を分離して証明した。全入力頂点がclosed half-plane内なら出力convex hullは`indexedVertexConvexRegion ∩ halfPlaneRegion`にexactに一致し、全入力頂点がstrictly outsideなら両領域とも空になる。これらも入力convexityを必要としない。
- 残る逆包含を`ClipRegionComplete`として分離し、既証明の無条件soundnessと合わせると連続領域等号と必要十分になることを証明した。no-cut / empty-cutはこの完全性contractを満たす。
- 旧support-half-plane意味論とvertex-convex意味論の等号を`SupportSemanticsAdequate`として分離した。
- `IsSimpleRing ∧ IsWeaklyConvexCCW`だけでは`SupportSemanticsAdequate`を導けない。三つの相異なる共線点はこの両contractを満たすが、support領域は無限直線、vertex convex hullは有限線分になるLean反例を保持した。したがってfull-dimensionalityまたは意味論等号の直接仮定が必要である。
- `TriangleSupportSemantics`で、三角形内の点を三つのorientation比によるbarycentric coordinateで再構成した。3本のsupport不等式から各weightの非負性と総和1を導き、`IsStrictVertexOrderedConvexCCW`を満たす三角形で`SupportSemanticsAdequate`がexactに成立することを証明した。
- `QuadrilateralSupportSemantics`と`PentagonSupportSemantics`で、頂点0からの対角線に対する点の符号によりfan triangleを選び、三角形定理へ帰着する有限caseを検証した。
- `PolygonSupportSemantics`でこのfan分割を任意頂点数へ一般化した。末尾への対角線の左側なら末尾triangleへ、右側なら末尾頂点を除いたprefix polygonへ帰着する帰納法により、任意の`IsStrictVertexOrderedConvexCCW`入力で`indexedPolygonRegion = indexedVertexConvexRegion`を証明した。したがってstrict global orderは`SupportSemanticsAdequate`の十分条件である。
- `FanSupportSemantics`で十分条件をさらに弱めた。globalなweak vertex orderに加え、頂点0を根とする各fan triangleのorientationが正であるという再帰的certificateだけで`SupportSemanticsAdequate`が成立する。これはfan cell以外の共線三点を許し、strict global orderからcertificateを構成できることも証明した。
- `RedundantVertexSemantics`で、閉じ辺を`[0,1]`補間点で分割する末尾頂点を追加・除去しても、edge-support領域とvertex convex hullがそれぞれexactに不変であることを証明した。これをpositive fan stepと合成した`HasReducibleFan`により、正面積cellとゼロ面積の冗長subdivisionが混在するweak ordered polygonでも`SupportSemanticsAdequate`を導ける。
- `FanBetweenness`で、正orientationのoff-line witnessと二つのweak support条件から、共線点を閉じ辺上の`[0,1]`補間としてorientation面積比で再構成した。weak global orderはこの二つのsupport条件を自動供給する。さらにwitness伝播が失敗する唯一のcaseは末尾頂点と頂点0の重複であることを示し、injectivityまたは`IsSimpleRing`で排除した。結果として、weak global vertex order、injectivity（またはsimplicity）、正orientationの先頭三角形から、任意頂点数の`SupportSemanticsAdequate`を証明した。途中のゼロ面積fan cellは許容される。
- `SeamSupportSemantics`で、weak global order、edge-support領域、vertex convex hull、injectivityが巡回reindexで保存されることを証明した。正の先頭三角形を持つseamの存在は、どこかの三つのcyclic adjacent verticesが正orientationを持つことと同値である。したがって元のmaterialization seamによらず、weak global order、simplicity、positive cyclic turnから`SupportSemanticsAdequate`を導ける。
- `FullDimensionalSupportSemantics`で、連続する二つの共線tripleが非退化な共有辺を持つとき、外側のtripleも共線になるdeterminant補題を証明した。正orientation tripleのindex spanに対する強帰納法により、weak global orderとinjectivityの下では任意の正tripleから正のcyclic adjacent turnを抽出できる。回転不変定理と合成し、weak global order、injectivityまたは`IsSimpleRing`、通常のfull-dimensionality（任意の正orientation tripleの存在）から、seam指定なしで`SupportSemanticsAdequate`を証明した。
- `ClipCompleteness`で、実行可能な出力列のconvex hullと「保持頂点＋交差点」という宣言的生成集合のconvex hullがexactに一致することを証明した。これにより`ClipRegionComplete`はlist順序・destutter・closureに依存しない純粋な`BoundaryGeneratorHullComplete`と必要十分になり、残る義務を凸幾何だけへ分離した。
- `TriangleClipCompleteness`で、内側1頂点・外側2頂点のbarycentric combinationがhalf-plane内に残るなら、内側頂点と2交点のconvex combinationへ重みを移送できることを証明した。内側2頂点・外側1頂点では、外側weightを両内側頂点のsigned-distance容量以下に分割し、内側2点と2交点のconvex combinationを構成した。境界生成集合と`BoundaryGeneratorHullComplete`の循環reindex不変性により全6 mixed labelingを閉じ、clip境界がどの入力頂点も通らないstrict ordered triangleでは、no-cut / empty-cutを含む全符号caseの実行可能連続領域等号を証明した。

### 未証明・実証が必要なこと

- strict triangleのmixed crossingは、clip境界が入力頂点を通らないgeneric-position条件の下で全符号caseを統合済み。残る最小義務はsigned distanceが0の境界頂点を含む退化caseであり、その後にordered-convex一般多角形へ持ち上げる。
- empty / point / segment / polygonの正準表現と、その意味保存・冪等性・一意性。
- 共線点除去、隣接重複除去、winding統一、巡回始点選択を合成したcanonicalizer。
- 有理座標の小規模全探索による、完全一致命題の反例探索。

集合交差の可換性自体は標準事実である。成果候補は、退化を含む実行可能emitterと正準化の検証済み接続である。

## 4. 階層レイアウトの局所変更非干渉性

### 問いたいこと

部分木内の変更が、定義した影響閉包の外側のcellを変えないか。完全同一性が不可能な方式では、閉包外変位の上界へ弱める。

### 現在証明できたこと

- `LayoutNoninterference`でlayoutをstable IDからcellへの関数、local repairを明示的patchとしてモデル化した。
- patchのsupportが影響集合内なら、集合外のcellが完全に不変であるframe ruleを証明した。
- 二つのpatchの合成はsupportの和集合内に留まり、書き込み先がdisjointな生成済みpatchは適用順序によらないことを証明した。
- state-dependent patchを途中で再生成する場合、disjoint writeに加えて、各generatorが相手patchの適用に対して不変なら可換になることを証明した。これによりwrite footprintとread footprintの義務を分離した。
- `HierarchyNoninterference`でparent mapの反射推移閉包としてaffected ancestor closureを定義し、changed node自身の包含、親方向の閉包性、閉包外frame rule、disjointなancestor closureに支持されたpatchの可換性を証明した。

### 未証明・実証が必要なこと

- 実controllerのparent chainと形式化したancestor closureの対応。
- 実layout algorithmが生成するpatchのsupport保証。
- patch生成器が閉包外の状態を読まない、または読んでも結果が変わらないというread-footprint保証。
- global capacity solverが非干渉性を破る最小例と、局所修復法による改善。
- 完全不変性を満たせない場合の変位上界。

現在のframe ruleは、生成済みpatchの適用についての定理である。実装が局所patchを生成することまで証明したとは扱わない。

## 次の証明順序

1. 二候補witnessを実candidate metricへ埋め込み、TypeScriptでも同じ非可換squareを共有fixtureとして実行する。
2. 出力ringの領域意味論を定義し、保持頂点とcrossing交点の完全性から一段emitter soundnessの逆包含を証明する。
3. 退化表現を含むcanonicalizerを定義し、意味保存・冪等性・一意性を証明する。
4. controllerのparent chainとancestor closureを共有fixtureで対応づけ、実patch生成器のsupport契約へ接続する。
