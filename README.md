# Convert Github mention to Slack mention

This action sends mention to your slack account when you have been mentioned at github.

## Feature

This action has two modes, controlled by the `type` input (aligned with GitHub's official Slack integration terminology):

- **`realtime-alert`** (default) — event-driven notifications:
  - Send mention to slack if you have been mentioned in an issue or pull request
  - Send notification to slack if you have been requested to review
  - Send notification to slack if your pull request has been approved
- **`scheduled-reminder`** — an alternative to GitHub's Scheduled Reminders. On a cron schedule, posts an aggregated summary of open pull requests with pending review requests. See [Scheduled reminder](#scheduled-reminder) below.

## Inputs

| Name               | Required | Default                      | Description                                                                                                                                              |
| :----------------- | :------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| configuration-path | Yes      | .github/mention-to-slack.yml | Path to config-yaml-file to convert Github username to Slack member ID. You can use local file path or URL like https://github.com/path/to/yaml_raw_file |
| slack-webhook-url  | Yes      | Null                         | Slack Incomming Webhook URL to notify.                                                                                                                   |
| repo-token         | Yes      | Null                         | Github access token to fetch .github/mention-to-slack.yml file.                                                                                          |
| bot-name           | No       | Github Mention To Slack      | Display name for this bot on Slack.                                                                                                                      |
| icon-url           | No       | Null                         | Display icon url for this bot on Slack.                                                                                                                  |
| run-id             | No       | Null                         | Used for the link in the error message when an error occurs.                                                                                             |
| type               | No       | realtime-alert               | Mode of operation. `realtime-alert` (default) sends event-driven mention/review notifications. `scheduled-reminder` posts an aggregated reminder of open pull requests with pending review requests. Leaving it empty is the same as `realtime-alert`. |

## Example usage

### Realtime alert (event-driven mentions / review notifications)

.github/workflows/mention-to-slack.yml

```yml
on:
  issues:
    types: [opened, edited]
  issue_comment:
    types: [created, edited]
  pull_request:
    types: [opened, edited, review_requested]
  pull_request_review:
    types: [submitted]
  pull_request_review_comment:
    types: [created, edited]

jobs:
  mention-to-slack:
    runs-on: ubuntu-latest
    steps:
      - name: Run
        uses: abeyuya/actions-mention-to-slack@v2
        with:
          type: realtime-alert
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          icon-url: https://img.icons8.com/color/256/000000/github-2.png
          bot-name: "Send Mention from abeyuya/actions-mention-to-slack"
          run-id: ${{ github.run_id }}
```

`type` is optional and defaults to `realtime-alert`, so existing workflows without this field keep working unchanged.

### Scheduled reminder

When invoked with `type: scheduled-reminder`, this action queries the open pull requests in the repository and posts a single aggregated Slack message listing each pending reviewer and the pull requests waiting on them. Users that appear in the mapping YAML are mentioned with `<@slack_id>` (or `<!subteam^id>` for teams); users not in the mapping are listed by their GitHub username.

- Draft pull requests are excluded.
- If there are no pending review requests, nothing is posted.

.github/workflows/review-reminder.yml

```yml
name: Review reminder to Slack

on:
  schedule:
    # Weekdays 10:00 JST (= 01:00 UTC)
    - cron: "0 1 * * 1-5"
  workflow_dispatch:

jobs:
  review-reminder:
    runs-on: ubuntu-latest
    steps:
      - name: Run
        uses: abeyuya/actions-mention-to-slack@v2
        with:
          type: scheduled-reminder
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          configuration-path: .github/mention-to-slack.yml
          bot-name: "Review Reminder"
```

### Mapping configuration

Both modes use the same GitHub-username-to-Slack-ID mapping YAML referenced by `configuration-path`.

.github/mention-to-slack.yml

```yml
# For Github User
# github_username: "slack_member_id"

github_username_A: "slack_member_id_A"
github_username_B: "slack_member_id_B"
github_username_C: "slack_member_id_C"
abeyuya: "XXXXXXXXX"

# For Github Team
# github_teamname: "slack_member_id"

github_teamname_A: "slack_member_id_D"
```
