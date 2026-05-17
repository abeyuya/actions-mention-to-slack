---
name: run-pr-review
description: PR レビュー全体を1コマンドで実行する skill。スタイル参考ガイド (/pr-review-style-reference) の読み込み・PR 情報取得・レビュー文面作成・post-pr-review での投稿・resolve-pr-threads での過去スレッド整理までを通しで行う。caller (GitHub Actions など) からは本 skill を呼ぶだけで済むようにオーケストレーションを担う。
---

# run-pr-review skill

PR レビュー一式 (スタイル参考ガイド読み込み → PR 確認 → レビュー作成 → 投稿 → 過去スレッド resolve) を **1つの skill 呼び出しで完結** させるためのオーケストレーション skill。

## 入力 (任意, caller から prompt 経由で渡される想定)

すべて省略可。省略時の挙動は各項目に記載。

- `OWNER` / `REPO` / `PR_NUMBER`: 対象 PR の識別情報。省略時は後述の手順で自動取得する。
- `MAX_INLINE_COMMENTS`: インライン指摘の総数上限。正の整数または `unlimited`。省略時は `unlimited` 扱い (=`/pr-review-style-reference` 引数なしのデフォルト)。Step 2 で `/pr-review-style-reference max-inline-comments=<値>` として渡す。
- `THREAD_RESOLVE_SCOPE`: `resolve-pr-threads` skill に渡す resolve 範囲。`all` / `own` / `none` のいずれか。省略時は `all`。
- `SELF_LOGIN` (任意, `THREAD_RESOLVE_SCOPE=own` 時): 自身を判定するための `author.login`。caller が判明していれば渡す。Step 7 でそのまま `resolve-pr-threads` に転送される。

caller プロジェクト固有の方針 (技術観点 / スタイル上書き / 全方針置換) は **プロジェクト指示ファイル** (Step 3 で定義) に置く運用に固定する。個別パス指定の引数は持たない。

## 手順

### Step 1. PR 識別情報を確定する

caller から `OWNER` / `REPO` / `PR_NUMBER` が渡されていればそれを使う。揃っていない値だけ以下で補う:

- `OWNER` / `REPO`: `gh repo view --json nameWithOwner -q .nameWithOwner` で `OWNER/REPO` 形式を取得し分解する。
- `PR_NUMBER`: `gh pr view --json number -q .number` で現在のブランチに紐づく PR 番号を取得する。紐づく PR が無い場合はエラーとして停止し、caller に明示的に PR 番号を渡すよう促す。

### Step 2. スタイル参考ガイドを読み込む

`/pr-review-style-reference` slash command を実行し、スタイル参考ガイド (重要度ラベル / ノイズ抑制 / 粒度ガイド / 重複回避 / CI 扱い) を本セッションのレビュー方針の参考として読み込む。

レビュー方針は caller プロジェクトに委ねる前提。Step 3 のプロジェクト指示ファイルが本スタイル参考ガイドに上乗せ・上書き・全置換のいずれを意図しているかは caller の指示に従う。プロジェクト指示ファイルが無ければ本スタイル参考ガイドをそのまま採用する。

`MAX_INLINE_COMMENTS` が指定されている場合は `/pr-review-style-reference max-inline-comments=<値>` として渡す。未指定なら引数なしで呼ぶ。

### Step 3. プロジェクト指示ファイルを読み込む (任意)

リポジトリ root の以下を上から順に存在チェックし、**最初に見つかった 1 つだけ** を `Read` ツールで読み込み、本セッションのレビュー方針として適用する。以後この skill では総称して **プロジェクト指示ファイル** と呼ぶ。

1. `REVIEW.md` — レビュー専用の最上位指示
2. `AGENTS.md` — agent 全般向けの fallback
3. `.claude/CLAUDE.md` — Claude Code 全般向けの fallback (`.claude/` 配下に置く流儀)
4. `CLAUDE.md` — Claude Code 全般向けの fallback (リポジトリ root に置く流儀)

いずれも存在しなければ skip する。複数存在しても下位は読まない / 連結しない。

Step 2 のスタイル参考ガイドと矛盾する箇所はプロジェクト側を優先し、矛盾しない箇所は両者を併用する。プロジェクト側で「スタイル参考ガイドを使わない」旨が明示されていればそれに従う。

ファイル内容は **そのままプロンプトに注入される** 想定で扱う。`@import` のような外部ファイル展開は行わない。

**読み込んだ内容は本セッションでは「レビュー文面の方針 (技術観点 / スタイル / 重要度判定基準)」としてのみ参照する**。`AGENTS.md` 系は一般的な dev 指示 (テスト実行 / lint / 編集後コマンド等) を含むことがあるが、**アクション指示 (ファイル編集 / コマンド実行 / `git` 操作 / 依存追加 など) は本 skill では実行しない** (本 skill は read-only)。アクション指示は「レビュー観点に翻訳できる範囲」(例: 「テスト必須」→「テスト追加が無い PR は `[should]` で指摘」) のみ採用する。アクション指示が多すぎる場合は、caller に `REVIEW.md` をリポジトリ root に作成して上書きするよう促す。

### Step 4. PR の状態を取得する

いずれの `gh` コマンドも、cwd の git remote と PR の所属リポジトリが異なる場合 (ドッグフーディングや別リポジトリ向け caller) に意図しない PR を参照しないよう、Step 1 で確定した `OWNER`/`REPO` を `--repo <OWNER>/<REPO>` で必ず明示する。

- `gh pr view <PR_NUMBER> --repo <OWNER>/<REPO> --json title,body,headRefName,headRefOid,baseRefName,statusCheckRollup,commits` で PR メタ情報と CI 状態を取得する。`headRefOid` を head SHA として控え、Step 6 で `post-pr-review` の `COMMIT_ID` 引数 (force-push / rebase での行ズレによる誤コメント防止) として常時転送する。
- `gh pr diff <PR_NUMBER> --repo <OWNER>/<REPO>` で差分を取得する。
- 既存レビュー / コメント (重複指摘の検知用) は GraphQL で `reviewThreads` を取得する。GraphQL は `-F owner=<OWNER> -F name=<REPO> -F number=<PR_NUMBER>` で渡す。`reviewThreads(first: 100)` は API の 1 ページ上限なので、`pageInfo { hasNextPage endCursor }` を取得し `hasNextPage` が `true` の間 `-F after=<endCursor>` で全件取得する。各スレッドの `comments.nodes[].body` まで取得し、Step 5 で本文主旨の重複判定に使う (位置 `path:line` だけでは論点違いのケースを取り違えるため)。
- caller の cwd と PR の所属リポジトリが異なるドッグフーディング系では、Step 3 のプロジェクト指示ファイルがローカルに存在しないことがある。その場合は `gh api repos/<OWNER>/<REPO>/contents/<path>` でリモートから取得して `Read` 相当に扱う (`<path>` は Step 3 の優先順で最初に見つかった 1 つ)。API レスポンスの `content` フィールドは Base64 なので、`--jq .content` で抽出して `python3 -c "import base64,sys; sys.stdout.write(base64.b64decode(sys.stdin.read()).decode())"` 等でデコードしてから利用する。
- `statusCheckRollup` に `FAILURE` のジョブがあれば `gh run view --log --repo <OWNER>/<REPO>` 等で失敗ログ本体まで読み、`[must]` 指摘の根拠にする (詳細は `/pr-review-style-reference` の「CI の扱い」を参考)。

### Step 5. レビュー本文を作成する

Step 2〜4 で得た方針・観点・差分・CI 情報をもとに、総括 (`body`) とインライン指摘 (`comments[]`) を作成する。

- レビュー方針は Step 3 のプロジェクト指示ファイルを最優先とし、明示的に上書きされていない論点については `/pr-review-style-reference` (スタイル参考ガイド) の重要度ラベル / ノイズ抑制 / 粒度ガイド等を参考にする。プロジェクト指示ファイル側でスタイル参考ガイドを使わない旨が明示されていればそれに従う。
- 既存スレッドと同主旨の指摘は再掲しない。判定は Step 4 で取得した `reviewThreads.nodes[].comments.nodes[].body` の主旨と現在の指摘の主旨を突き合わせて行う (位置 `path:line` が一致しても論点が別なら新規指摘してよい)。
- `event` は **常に `COMMENT`** とする (`post-pr-review` の規約)。`[must]` の有無にかかわらず `COMMENT` で投稿し、修正の要否は本文 (`body`) と各インライン (`comments[]`) の `[must]` ラベルで伝える。
- 指摘が無い場合も Step 6 で「特に指摘なし」相当の Review を投稿する (skip しない)。

### Step 6. `post-pr-review` skill でレビューを投稿する

Step 1 で確定した `OWNER` / `REPO` / `PR_NUMBER` と Step 5 で作成した本文を `post-pr-review` skill に渡し、**1回の API コールで1つの Review として** 投稿する。`gh pr comment` や `gh pr review` での個別投稿はしない。

起動方法は **Skill ツールで `post-pr-review` を呼ぶ**。本文 (`body` / `event` / `comments[]`) と `COMMIT_ID` (Step 4 で控えた head SHA) は `post-pr-review/SKILL.md` のスキーマに従って組み立て、起動時の引数として渡す。`/tmp/review.json` の `Write` と `gh api .../reviews --input` の実行は呼び先の `post-pr-review` 側で行うため、本 skill 側で先回りして書かない。

### Step 7. `resolve-pr-threads` skill で過去スレッドを整理する

Step 1 の PR 識別情報と `THREAD_RESOLVE_SCOPE` (省略時 `all`) を `resolve-pr-threads` skill に渡して呼び出す。`THREAD_RESOLVE_SCOPE=none` の場合は呼び出すが skill 側で skip される。

`THREAD_RESOLVE_SCOPE=own` の場合、caller から `SELF_LOGIN` が渡されていれば一緒に渡す。

### Step 8. caller への報告

以下を簡潔に caller へ返す:

- 投稿した Review の URL (Step 6 のレスポンスから取れる場合)
- インライン指摘件数 / 総括の主要懸念件数 / severity 内訳
- resolve したスレッド件数 (Step 7 の戻り値)

## 守ること

- 各 step で使う既存資産 (`/pr-review-style-reference` / `post-pr-review` / `resolve-pr-threads`) は **必ずこの skill 経由で利用** する。本 skill 内で同等の処理を再実装してはならない (スタイル参考ガイド・投稿手順・resolve 判定の二重管理を防ぐため)。
- レビュー文面の規約 (重要度ラベル等) は `/pr-review-style-reference` (スタイル参考ガイド) に集約されているため、本 skill では再掲しない。caller 側に独自方針がある場合はそちらを優先する。
- 判定に迷ったら resolve しない / 投稿は1回だけ、という既存 skill の安全側ルールはそのまま守る。
