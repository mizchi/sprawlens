# Sprawlens formalization

Sprawlensの実行実装はTypeScript / JavaScriptに置き、ここでは論文の中心contractを実装詳細から独立したLean 4の定理として管理する。LeanからJavaScriptを生成せず、手書きTypeScriptとの対応は`claims.json`と共有conformance fixtureで監査する。

## Pinned environment

- Lean: `v4.33.0`
- Mathlib: `v4.33.0` (`db584cd6d46c92f209a44c0f1c829460d327499d`)
  - L0–L2はMathlib非依存。
  - L3のfinite center of mass、convex hull、ordered-field algebraだけに使用する。

## Commands

```bash
just lean-check
just lean-conformance
```

`lean-check`は定理をmachine-checkする。`lean-conformance`はそれに加えて、
`TestVectors/feasible-envelope.json`、`TestVectors/external-sequence-gate.json`、`TestVectors/temporal-barycenter.json`、`TestVectors/orientation.json`、`TestVectors/proper-segment-intersection.json`、`TestVectors/point-in-open-segment.json`、`TestVectors/collinear-open-overlap.json`、`TestVectors/simple-open-ring.json`、`TestVectors/polygon-signed-area.json`、`TestVectors/half-plane-boundary-parameter.json`、`TestVectors/half-plane-edge-classification.json`をLean executableとTypeScriptの純粋関数の双方で実行する。

## Current model

`Sprawlens.FeasibleEnvelope`はcandidate、constraint score、selection costの具体型を仮定しない。有限候補集合、validity predicate、複数constraint floor、cost最小性、baseline fallbackだけを扱う。

baselineがeligibleなら、任意のselection resultについて次を証明済みである。

- selected candidateは宣言した有限集合の要素である。
- selected candidateはvalidである。
- selected candidateは全constraint floorを満たす。
- selected costはbaseline cost以下である。

eligible集合が空の場合はbaselineへfallbackする。baseline自身がinvalidならresultもinvalidになりうるため、「全resultがvalid」は成り立たない。この反例をLean file内のwitnessとして保持する。

現段階で証明したのはabstract selection relationであり、TypeScriptのsort実装、floating-point score、candidate生成、solver convergenceの正しさではない。

`Sprawlens.ControlledPaths`は第二論文のcontrolled sequenceを離散graphとして一般化する。no-op / reversalの始終端同値性、weight変更とleaf追加、weight変更とedge rewireの可換性を証明した。graphはlistで保持するため、AB/BAの終端同値性はnode、weight、edge、request orderの完全一致である。これは同じ入力graphへ至ったlayout geometryが一致するという主張ではなく、その差をpath dependenceとして識別できるための前提だけを証明する。

`Sprawlens.ExternalSupport`はrequest / frozen capabilityからのexpected-support判定、responseのtotal classification、confirmatory effect gateを扱う。expected-supportedへの`unsupported`とexpected-unsupportedへの`ok`をそれぞれfailureへ分類し、一つでもpath gateが落ちればeffectを生成できないことを証明した。TypeScript側では`externalSequenceGate.ts`を純粋moduleとして分離し、探索用`calibration`と全gate通過後の`confirmatoryEffect`を別フィールドにした。

`Sprawlens.TemporalBarycenter`はfinite weighted centerとUIで使う2点のhistory mixを、座標型や次元に依存しないmoduleとして扱う。index relabeling、translation、uniform scaleに対する不変性と、非負weight・正の総weightでconvex hull内に入ることを証明した。TypeScript側の`barycenter.ts`はIEEE-754実装なのでbit-level permutation invarianceは主張せず、6ケースの有理数fixtureとtolerance testで対応を監査する。この標準的なaffine性質自体は論文の新規性に数えない。

`Sprawlens.ExactGeometry`はpolygon判定の基礎となる2次元orientation determinantをordered field上で定義する。translation invariance、uniform scaleに対する二次性、巡回置換・反転、strict left turnなら3点が相異なることを証明した。TypeScript側ではpolygon validityとconvex hullが同じ`orientationDeterminant`を使い、6ケースの整数座標fixtureをLeanの有理数modelと共有する。これは標準的な計算幾何の基礎であり、新規性ではない。また、simple polygon、self-intersection、clipping、面積保存まで証明したことを意味しない。

`Sprawlens.SegmentIntersection`は、二本のopen segmentの内部が横断するproper intersectionを、双方のorientationがstrict opposite signsになる関係として定義する。segment交換、各segmentの端点反転、translation、非ゼロuniform scaleに対する不変性と、proper intersectionなら四つの端点を共有しないことを証明した。実行可能なBool判定器と論理predicateの同値性も証明し、TypeScriptと8ケースを共有する。端点接触と共線重複は意図的にこのpredicateから除外する。epsilon付きの近似判定、polygon edgeの隣接関係、ring全体のsimple性はまだ証明対象ではない。

`Sprawlens.SegmentContact`は、点がsegmentと共線で、少なくとも一軸で端点間に厳密に入り、他方でも閉区間内にあることをopen-segment membershipとして定義する。端点反転、translation、正負を含む非ゼロuniform scaleに対する不変性、membershipによる端点・退化segmentの排除、Bool判定器との同値性を証明した。TypeScriptのdominant-axis実装とは11ケースのexact整数fixtureを共有する。floating-point toleranceの完全性・健全性は証明していない。

`Sprawlens.CollinearOverlap`は、二本の非退化segmentについて、一方の端点が他方のopen segment内部にあるか、両segmentが同一または反転同一であることを、open interiorsが正の長さで重なるexact relationとして定義する。実行可能Bool判定器との同値性、segment交換対称性、非退化性、同一・反転segmentの包含を証明し、TypeScriptのinterval実装と10ケースを共有する。min/max実装全体やfloating-point toleranceの一般証明ではない。

`Sprawlens.SimpleRing`は最低3頂点を型で保証するcyclic index、edge successor、隣接edge関係を定義し、頂点のinjectivity、全edgeの非退化、全非隣接edge pairでproper crossing・open-segment contact・collinear overlapがないことをtopological simplicityとする。segment conflictのBool判定器との同値性、edge隣接の対称性、simple ringから各無衝突条件が得られることを証明した。TypeScriptのcyclic pair走査とは8ケースのring fixtureを共有するが、走査実装全体の一般同値証明ではない。convexityとwinding directionはこのcontractに含めない。

`Sprawlens.PolygonArea`は有限index集合とcyclic successor permutation上のshoelace sumをsigned twice-areaとして定義する。translation invariance、uniform scaleに対する二乗則、successor反転による符号反転、三角形ではorientation determinantと一致することを証明した。TypeScriptでは既存`signedArea`を`signedTwiceArea / 2`として再構成し、符号、translation、scale、退化列を含む9ケースを共有する。clipping algorithmの面積単調性を証明したことは意味しない。

`Sprawlens.HalfPlaneIntersection`は、二点の符号付き距離をaffine補間して半平面境界と交わるparameterを定義する。内側から外側、外側から内側の双方について分母の非零性とparameterが`[0, 1]`に入ること、得られる補間距離がexactに0になることを証明した。TypeScriptではこの関数を`clipHalfPlane`の交点生成に組み込み、端点を含む6ケースの有理数fixtureを共有する。多角形の出力列、orientation保存、clipping後の面積境界は後続のcontractで扱う。

`Sprawlens.HalfPlaneClipStep`は、oriented edgeをclosed half-planeに対してinside / leaving / entering / outsideへ全分類する。各classと二点の符号条件の同値性を証明し、leaving / enteringからboundary parameterの`[0, 1]`包含を導いた。さらに一辺が出力する符号付き距離列を最小modelとし、長さが最大2、重複なし、全要素が半平面内であることを証明した。TypeScriptの`clipHalfPlane`も同じ分類・step emitterを使用し、境界端点と期待出力を含む8ケースを共有する。この分離で発見した境界頂点の二重出力は、step内とcyclic closureの重複排除、および退化ringの回帰testで修正した。複数edgeを連結した出力列全体の一般証明は次段階である。

## 証拠の境界

- Lean theorem: 抽象modelの全入力に対する証明。
- 共有fixture: 現在のTypeScript実装とLean executableが選んだ結果の有限例での一致。
- TypeScript unit test: controlled path builderが具体例でexact endpointを作る回帰検査。

したがって、共有fixture通過をTypeScript実装全体の形式証明とは呼ばない。
