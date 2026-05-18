# Convert Github mention to Slack mention

This action sends mention to your slack account when you have been mentioned at github.

## About

This action aims to be an alternative to GitHub's official [Scheduled reminders](https://docs.github.com/en/subscriptions-and-notifications/concepts/scheduled-reminders) (the real-time alerts part — review requests, mentions, etc.). If your organization has Scheduled reminders enabled and all the people you want to notify can use it, prefer the official feature.

Use this action when Scheduled reminders are not available, for example:

- Your organization has not enabled Scheduled reminders.
- You want to notify outside collaborators, who cannot use Scheduled reminders even when the organization has it enabled.

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

Each pull-request entry includes:

- PR number and title (linked)
- Time since the PR was opened (e.g. `3d`, `5h`)
- Current approval state: `:white_check_mark: approved`, `:warning: changes requested`, or `:hourglass_flowing_sand: review required`
- Labels attached to the PR (up to 5; the rest are summarized as `, +N more`)

The notification is delivered as a Slack Block Kit message with a plain-text fallback, so it renders well in modern Slack clients and degrades gracefully where Block Kit is unavailable.

Example rendering (text fallback):

```
:eyes: Pending review reminders for `owner/repo`:

<@U_ALICE>
• <https://github.com/owner/repo/pull/123|#123 Fix login bug>
_3d • :warning: changes requested • `bug`, `priority-high`_
• <https://github.com/owner/repo/pull/130|#130 Refactor auth>
_5h • :hourglass_flowing_sand: review required_
```

- Draft pull requests are excluded.
- If there are no pending review requests, nothing is posted.
- Approval state is fetched via the `pulls.listReviews` API for each PR with pending reviewers. Calls are made in chunks of 5 to stay friendly to API rate limits.

`scheduled-reminder` calls the GitHub REST API, so the job needs `pull-requests: read` (for `pulls.list` / `pulls.listReviews`) and `contents: read` (to fetch the configuration YAML via `repos.getContent`). If your repository or organization defaults the workflow `GITHUB_TOKEN` to read-only or restricted scopes, omitting these will surface as `HttpError: Resource not accessible by integration`. Set them at the job level as shown below.

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
    permissions:
      contents: read
      pull-requests: read
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

## Local AI PR review (optional)

This repo bundles the [abeyuya/skills](https://github.com/abeyuya/skills) `pr-review` plugin under `.claude/` via [apm](https://github.com/microsoft/apm). Open Claude Code in this repo and invoke the skill, e.g.:

- `run-local-review skill を呼んで` — review the current local branch before pushing.
- `run-pr-review skill を呼んで OWNER=abeyuya REPO=actions-mention-to-slack PR_NUMBER=<n>` — post a review to an existing PR.

To update the skill: install [apm](https://github.com/microsoft/apm), run `apm install` at the repo root to refresh `.claude/` and `apm.lock.yaml`, then commit the resulting diff.
