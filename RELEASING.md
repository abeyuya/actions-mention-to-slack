# Releasing

`abeyuya/actions-mention-to-slack` の v2.X リリース手順。

## 前提

- `master` への push をトリガに `.github/workflows/release-latest-tag.yml` が走り、`release` ブランチに master をマージ + `dist/` を build & commit + `latest` タグを force-update する (build に差分があるときのみ commit / tag 更新)。
- v2.X のセマンティックタグ / `v2` major タグ / GitHub Release の作成は手動。
- `package.json` の `version` は意図的に更新しない (バージョン管理は git タグ側に寄せている)。

## 手順

新しい v2.X をリリースする。`NEW_VERSION` を差し替えて実行。

```bash
NEW_VERSION=v2.13
REPO=abeyuya/actions-mention-to-slack
```

### 1. 事前確認

```bash
gh auth status

git fetch origin master release --tags
git log -1 --oneline origin/release   # "update build N" になっているはず

gh run list -R "$REPO" \
  --workflow=release-latest-tag.yml --limit 3

git ls-remote --tags origin "$NEW_VERSION"   # 何も返らないこと
```

`release-latest-tag.yml` の最新実行が `success` でなければ、原因を確認してから進める。

### 2. GitHub Release + タグ作成

```bash
gh release create "$NEW_VERSION" \
  -R "$REPO" \
  --target release \
  --title "$NEW_VERSION" \
  --generate-notes
```

- `--target release` で `origin/release` HEAD (`update build N` コミット) にタグが付く。
- `--generate-notes` で前リリースからの Merged PR 一覧を自動生成。

### 3. major タグ `v2` を新リリースに追従させる

`uses: abeyuya/actions-mention-to-slack@v2` の参照を新リリースに合わせるため、`v2` タグを force-update する。直前に作った `$NEW_VERSION` タグの SHA から引くことで、ステップ 2-3 の間に release-latest-tag workflow が走っても整合する。

```bash
RELEASE_SHA=$(git ls-remote --tags origin "$NEW_VERSION" | awk '{print $1}')
gh api -X PATCH \
  "/repos/$REPO/git/refs/tags/v2" \
  -f sha="$RELEASE_SHA" -F force=true
```

`git push origin "$RELEASE_SHA:refs/tags/v2" --force` は protected tag の都合で 403 になることがあるため、API 経由を推奨。

### 4. 確認

```bash
gh release view "$NEW_VERSION" -R "$REPO"
git ls-remote --tags origin "$NEW_VERSION" v2
```

- `$NEW_VERSION` と `v2` が同じ SHA を指していれば成功。
- `gh release view` でリリースノート本文と target commit を確認。
