# Send github mention to slack

This action sends mention to your slack account when you have been mentioned at github.

## Inputs

### `configuration-path`

**Required** Mapping config for Github username to Slack member ID. Default `.github/mention-to-slack.yml`.

```yml
# {github username}: {slack member id}
abeyuya: "XXXXXXXXX"
other_github_username: "slack_member_id_here"
```

### `slack-webhook-url`

**Required** Slack Incomming Webhook URL to notify.

### `repo-token`

**Required** Github access token to fetch .github/mention-to-slack.yml file.

### `bot-name`

**Optional** Display name for this bot on Slack.

### `icon-url`

**Optional** Display icon url for this bot on Slack.

## Example usage

.github/workflows/mention-to-slack.yml

```yml
on:
  issues:
    types: [opened]
  issue_comment:
    types: [created]
  pull_request:
    types: [opened, review_requested]
  pull_request_review:
    types: [submitted]
  pull_request_review_comment:
    types: [created]

jobs:
  mention-to-slack:
    runs-on: ubuntu-latest
    steps:
      - name: Run
        uses: abeyuya/actions-mention-to-slack@v1.22
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          icon-url: https://img.icons8.com/color/256/000000/github-2.png
```

.github/mention-to-slack.yml

```yml
abeyuya: "XXXXXXXXX"
other_github_username: "slack_member_id_here"
```

## Development

### build index.js

```
$ ./node_modules/.bin/tsc index.ts
```