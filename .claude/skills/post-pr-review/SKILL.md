---
name: post-pr-review
description: PR レビュー結果を1回の API コールで1つの Review として GitHub に投稿する。複数のインライン指摘や総括コメントを含むレビューを投稿する場合は必ずこの skill を使うこと。`gh pr comment` や `gh pr review` を使った個別投稿は禁止。
---

# post-pr-review skill

PR レビュー結果を **1回の API コールで「1つの Review」として投稿** する手順を提供する skill。
人間レビュアーの "Submit Review" と同じ構造で投稿する。

## 守ること

- レビュー結果は **必ず1回の API コール** で投稿する。
- 個別投稿系のツール (`mcp__github_inline_comment__create_inline_comment`、`gh pr comment` 等) は **使わない**。
- `event` は **常に `COMMENT`**。`APPROVE` / `REQUEST_CHANGES` は使わない (Bot がマージブロックや承認権を持つことを避けるため)。
- インラインコメントの本文フォーマット (重要度ラベル等) は **caller のレビュー方針に従う**。本 skill は手続きのみを担い、レビュー文面の規約は規定しない。
- 総括 `body` の先頭には **AI 自動投稿マーカーを必ず付与する** (詳細は「手順 1」参照)。認証主体が人間 PAT でも投稿内容は AI 生成であることを明示するため。caller 側で事前に付与する必要はなく、本 skill が一律に prepend する。エージェント名 (Claude Code / Codex / Cursor 等) はマーカーに含めない (本 skill は複数の AI エージェントから呼ばれうる前提)。

## 入力 (caller から prompt 経由で渡される想定)

- `OWNER` / `REPO` / `PR_NUMBER`: 対象 PR の識別情報
- レビュー本文 (総括 + インラインコメント配列)
- `COMMIT_ID` (任意): レビューを紐づける head commit の SHA。caller 側で `gh pr view ... --json commits` の末尾 `oid` を取得できる場合は渡すことを推奨。指定があれば手順 1 の JSON および手順 2 の API リクエストに含める (force-push / rebase で行ズレが起きた際の誤コメント防止に有効)。未指定なら省略 (GitHub 側で最新 commit を採用)。

## 手順

### 1. `body` 先頭に AI 自動投稿マーカーを付与し、`/tmp/review.json` を `Write` ツールで書き出す

`heredoc` や `cat` リダイレクトは使わず、必ず `Write` ツールで書く。

caller から渡された総括本文 (Markdown 可) はマーカーと区切り線 (`---`) の後ろに連結する。指摘なしの場合 (`comments` が `[]`) も同じマーカーを付ける。

マーカー文言 (エージェント非依存・固定):

```markdown
> **[AI 自動投稿]** このレビューは AI エージェントによって自動生成されました。レビュー内容の判断は AI が行っています。

---

<caller から渡された総括本文 (指摘なし時は「特に指摘なし」相当)>
```

スキーマは以下のとおり (`body` は上記マーカー込みの文字列):

```json
{
  "commit_id": "9f8e7d6c1a2b3c4d5e6f7890abcdef1234567890",
  "body": "> **[AI 自動投稿]** このレビューは AI エージェントによって自動生成されました。レビュー内容の判断は AI が行っています。\n\n---\n\n総括コメント本文 (Markdown可)",
  "event": "COMMENT",
  "comments": [
    {
      "path": "src/example.ts",
      "line": 42,
      "side": "RIGHT",
      "body": "[should] ここの処理は..."
    },
    {
      "path": "src/example.ts",
      "start_line": 50,
      "start_side": "RIGHT",
      "line": 55,
      "side": "RIGHT",
      "body": "[must] この複数行ブロックは..."
    }
  ]
}
```

- 単一行コメントは `path` / `line` / `side` を指定する。
- 複数行範囲のコメントは上記に加えて `start_line` / `start_side` を併用する (`start_line` は `line` より前の行)。
- `commit_id` は caller から `COMMIT_ID` が渡された場合のみ含める (詳細は「入力」参照)。
- 指摘がない場合: `body` はマーカー + 区切り線 + 「特に指摘なし」相当の文言、`comments` は `[]`、`event` は `COMMENT` で投稿する。
- インラインコメント (`comments[].body`) には個別マーカーを付けない (Review 本文側のマーカーで帰属は十分であり、`[must]` 等の重要度ラベルとの衝突や冗長さも避けるため)。

### 2. `gh api` を1回だけ実行して投稿する

```bash
gh api \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  /repos/<OWNER>/<REPO>/pulls/<PR_NUMBER>/reviews \
  --input /tmp/review.json
```

`<OWNER>/<REPO>` と `<PR_NUMBER>` は caller から渡された値で置き換える。
