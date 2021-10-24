# Convert Github mention to Slack mention

This action sends mention to your slack account when you have been mentioned at github.

## Feature

- Send mention to slack if you have been mentioned
  - issue
  - pull request
- Send notification to slack if you have been requested to review.
- Send notification to slack if your pull request have been approved.

## Inputs

| Name               | Required | Default                      | Description                                                                                                                                              |
| :----------------- | :------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| configuration-path | Yes      | .github/mention-to-slack.yml | Path to config-yaml-file to convert Github username to Slack member ID. You can use local file path or URL like https://github.com/path/to/yaml_raw_file |
| slack-webhook-url  | Yes      | Null                         | Slack Incomming Webhook URL to notify.                                                                                                                   |
| repo-token         | Yes      | Null                         | Github access token to fetch .github/mention-to-slack.yml file.                                                                                          |
| bot-name           | No       | Github Mention To Slack      | Display name for this bot on Slack.                                                                                                                      |
| icon-url           | No       | Null                         | Display icon url for this bot on Slack.                                                                                                                  |
| run-id             | No       | Null                         | Used for the link in the error message when an error occurs.                                                                                             |

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
