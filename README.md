# Convert Github mention to Slack mention

This action sends mention to your slack account when you have been mentioned at github.

## Feature

- Send mention to slack if you have been mentioned
  - issue
  - pull request
- Send notification to slack if you have been requested to review.
- Send notification to slack if your pull request have been approved.
- Send a scheduled reminder to slack listing open pull requests that have pending review requests (alternative to GitHub's Scheduled Reminders). See [Review reminder](#review-reminder) below.

## Inputs

| Name               | Required | Default                      | Description                                                                                                                                              |
| :----------------- | :------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| configuration-path | Yes      | .github/mention-to-slack.yml | Path to config-yaml-file to convert Github username to Slack member ID. You can use local file path or URL like https://github.com/path/to/yaml_raw_file |
| slack-webhook-url  | Yes      | Null                         | Slack Incomming Webhook URL to notify.                                                                                                                   |
| repo-token         | Yes      | Null                         | Github access token to fetch .github/mention-to-slack.yml file.                                                                                          |
| bot-name           | No       | Github Mention To Slack      | Display name for this bot on Slack.                                                                                                                      |
| icon-url           | No       | Null                         | Display icon url for this bot on Slack.                                                                                                                  |
| run-id             | No       | Null                         | Used for the link in the error message when an error occurs.                                                                                             |
| type               | No       | Null                         | Set to `reminder` to send a pending-review reminder for open pull requests. Leave empty for the default mention/notification behavior.                   |

## Example usage

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
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          icon-url: https://img.icons8.com/color/256/000000/github-2.png
          bot-name: "Send Mention from abeyuya/actions-mention-to-slack"
          run-id: ${{ github.run_id }}
```

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

## Review reminder

This action can also be used as an alternative to GitHub's Scheduled Reminders. When invoked with `type: reminder`, it queries the open pull requests in the repository and posts a single aggregated Slack message listing each pending reviewer and the pull requests waiting on them. Users that appear in the mapping YAML are mentioned with `<@slack_id>` (or `<!subteam^id>` for teams); users not in the mapping are listed by their GitHub username.

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
          type: reminder
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          configuration-path: .github/mention-to-slack.yml
          bot-name: "Review Reminder"
```
