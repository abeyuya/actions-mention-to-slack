---
name: resolve-pr-threads
description: PR の過去レビュースレッドのうち、指摘どおりに修正済みのものだけを resolve する。再レビュー後に古いスレッドを畳むのに使う。`THREAD_RESOLVE_SCOPE` 引数 (all / own / none) で resolve 範囲を制御する。判定に迷う場合は resolve しない。
---

# resolve-pr-threads skill

過去のレビュースレッドのうち修正済みのものを resolve する skill。
**誤判定で未対応の指摘を畳むと見落としに直結するため、判定に迷う場合は常に「resolve しない」を選ぶこと。**

## 入力

- `OWNER` / `REPO` / `PR_NUMBER`: 対象 PR
- `THREAD_RESOLVE_SCOPE`: resolve 範囲
  - `all` (デフォルト): すべての未 resolve スレッドを対象に、author 種別 (本レビュアー Bot / 他 Bot レビュアー / 人間レビュアー) を問わず resolve 候補にする。
  - `own`: 本アクション自身 (claude-code-action が用いる Bot) が author のスレッドのみ resolve 候補にする。判定は自身の過去コメントの `author.login` と一致するか否かで行う。判定が困難な場合は resolve しない。
  - `none`: 過去スレッドの resolve は一切行わない。本 skill 全体を skip する。
- `SELF_LOGIN` (任意): `THREAD_RESOLVE_SCOPE=own` 時に「自身」を判定するための `author.login`。caller が判明していれば渡す。未指定の場合は次の優先順で推定する:
  1. 直近の review / comment から `*[bot]` author で実行中アクションと一致するもの。
  2. それで決まらなければ、PR 内で `*[bot]` 投稿件数最多の author。複数 Bot 同居時は別 Bot (`github-copilot[bot]` 等) との取り違えに注意。
  3. 一意に決まらなければ scope=own をまるごと skip し、Step 5 で「SELF_LOGIN 推定不能」と報告する。

## 共通の resolve 判定ルール

- 既に `isResolved: true` のスレッドは触らない。
- resolve するのは **指摘内容どおりの修正が現在の差分・ファイル内容から確認できる場合のみ**。
- 以下のいずれかに該当する場合は resolve しない:
  - 指摘箇所が削除されただけで、別の場所に同じ問題が残っている可能性がある。
  - `isOutdated: true` だが、修正されたか単に行がずれただけかが判別できない。
  - 指摘が複数論点を含み、一部しか対応されていない。
  - そもそも修正されたかどうか判断に迷う。

## 手順

### Step 0. THREAD_RESOLVE_SCOPE のチェック

`THREAD_RESOLVE_SCOPE=none` の場合は何もせず終了する。

### Step 1. レビュースレッド一覧を取得する

`id` (Step 4 の `resolveReviewThread` mutation で必須) / `isResolved` / `isOutdated` / 各コメントの `author.login` / `path` / `line` / `body` を GraphQL で取得し、未 resolve スレッドすべてを判定対象とする。

`reviewThreads(first: 100)` は GitHub GraphQL API の 1 ページあたりの上限値。100 件を超える可能性がある場合はページネーションする。

```bash
gh api graphql \
  -F owner=<OWNER> \
  -F name=<REPO> \
  -F number=<PR_NUMBER> \
  -f query='
    query($owner: String!, $name: String!, $number: Int!, $after: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              isResolved
              isOutdated
              comments(first: 100) {
                nodes {
                  author { login }
                  path
                  line
                  originalLine
                  body
                }
              }
            }
          }
        }
      }
    }'
```

初回呼び出し時は `$after` を省略 (または `null`) する。`pageInfo.hasNextPage` が `true` の場合は `-F after=<endCursor>` を付けて同じクエリを再実行し、全スレッドを取得しきるまで繰り返す。

### Step 2. resolve 対象を決める

各スレッドについて以下を判定する。

1. `isResolved: true` ならスキップ。
2. `THREAD_RESOLVE_SCOPE=own` の場合、スレッド先頭コメントの `author.login` が `SELF_LOGIN` と一致しないならスキップ。
3. 上記「共通の resolve 判定ルール」に従って、指摘どおりに修正されたものだけを resolve 候補にする。コメントの `path` / `line` 周辺の現在のファイル内容と差分を必ず確認する。

### Step 3. resolve 根拠コメントを投稿する

resolve する前に、なぜ resolve するのか根拠を一言コメントで残す。後から「なぜこのスレッドが畳まれたのか」を追えるようにするため。

コメント本文には **必ず AI 自動投稿マーカーを先頭に付与する** (テンプレートと根拠は 3-2 参照)。

#### 3-1. 対応 commit を特定する

可能なら指摘箇所を修正した commit を特定し、その URL を根拠として添える。優先順は次の通り:

1. caller から特定の commit SHA が明示されている場合はそれを採用する (caller の意図を尊重)。
2. それ以外は `git blame <path> -L <line>,<line>` で該当行を最後に変更した commit を特定するのが最も確実。
3. (2) で取れない場合は `git log --oneline -- <path>` で対象ファイルの commit 履歴から推定する。
4. PR 全体の commit は `gh pr view <PR_NUMBER> --json commits` でも取得できる (補助情報)。

commit URL は `https://github.com/<OWNER>/<REPO>/commit/<COMMIT_SHA>` 形式。

特定できない場合 (リファクタで該当行が消えただけ等) は commit URL を省略し、根拠を文章で簡潔に書く。

#### 3-2. スレッドへ返信コメントを投稿する

`addPullRequestReviewThreadReply` mutation でスレッドに返信する。

**本文の先頭には AI 自動投稿マーカーを必ず付与する**。認証主体が人間 PAT でも投稿内容は AI 生成であることを明示するため。エージェント名 (Claude Code / Codex / Cursor 等) はマーカーに含めない (本 skill は複数の AI エージェントから呼ばれうる前提)。

マーカーと根拠コメントのテンプレート (`<根拠コメント本文>` は短く 1 文程度に抑える):

```markdown
> **[AI 自動投稿]** このコメントは AI エージェントによる自動投稿です。内容の判断は AI が行っています。

<根拠コメント本文>
```

例:

```markdown
> **[AI 自動投稿]** このコメントは AI エージェントによる自動投稿です。内容の判断は AI が行っています。

[abc1234](https://github.com/<OWNER>/<REPO>/commit/abc1234) で対応済みのため resolve します。
```

`body` には **テンプレート全体 (マーカー + `<根拠コメント本文>`)** を結合した文字列を渡す。複数行文字列を扱いやすくするため、`Write` ツールで body をファイル (例: `/tmp/resolve-body.txt`) に書き出してから `-F body=@/tmp/resolve-body.txt` で読み込ませる方法を推奨する。

```bash
gh api graphql \
  -F threadId=<THREAD_ID> \
  -F body=@/tmp/resolve-body.txt \
  -f query='
    mutation($threadId: ID!, $body: String!) {
      addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) {
        comment { id }
      }
    }'
```

### Step 4. `resolveReviewThread` mutation を実行する

Step 3 のコメント投稿が成功したスレッドのみ resolve する。`addPullRequestReviewThreadReply` が失敗した場合は **当該スレッドのみ skip し、resolve も実行せず次のスレッドへ進む** (全体停止はしない)。skip した件数は Step 5 で別カウントとして報告する。

`<THREAD_ID>` は Step 1 で得たスレッドの `id`。

```bash
gh api graphql \
  -F threadId=<THREAD_ID> \
  -f query='
    mutation($threadId: ID!) {
      resolveReviewThread(input: {threadId: $threadId}) {
        thread { id isResolved }
      }
    }'
```

`resolveReviewThread` が失敗した場合は **再試行せず次のスレッドへ進む** (再試行で根拠コメントが二重投稿になるのを避けるため)。Step 3 のコメントは投稿済みなので、当該スレッドは「根拠コメントだけ残り `isResolved=false` のオーファン状態」になる。これは Step 5 で別カウントとして caller に報告し、後続で人間が手動 resolve できるようにする。

### Step 5. caller への報告

以下の件数をそれぞれ分けて caller に返す (caller がレビュー本文の総括に「既存指摘のうち N 件は対応済みのためスレッドを resolve しました」と1〜2文で記載できるように)。**4 件種別の合計は「未 resolved スレッド総数」と一致**するように振り分ける (既 resolved は対象外で別枠):

- resolve したスレッド件数 (Step 4 まで成功したもの)
- コメント投稿失敗で resolve を見送った件数 (Step 3 の `addPullRequestReviewThreadReply` が失敗したもの)
- resolve 実行失敗で見送った件数 (Step 4 の `resolveReviewThread` が失敗したもの。**当該スレッド ID と path:line を明示**して人間が手動 resolve しやすくする)
- 判定保留で resolve しなかった件数 (Step 2 の判定で「resolve しない」とした未対応 / 判別不能 / scope=own で対象外、のもの)

別枠で参考表示する項目 (4 件種別の合計には含めない):

- 既に `isResolved=true` で対象外だったスレッド件数 (触っていない)
- `THREAD_RESOLVE_SCOPE=own` で `SELF_LOGIN` 推定が困難で skill 自体を skip した場合は、その旨を明示する。
