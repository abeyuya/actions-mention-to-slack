import * as core from "@actions/core";
import * as github from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";

import {
  pickupUsername,
  pickupInfoFromGithubPayload,
  loadNameMappingConfig
} from "./modules/github";
import { postToSlack, buildSlackPostMessage } from "./modules/slack";

const convertToSlackUsername = async (githubUsernames: string[]) => {
  const token = core.getInput("repo-token", { required: true });
  const configPath = core.getInput("configuration-path", { required: true });
  const githubClient = new github.GitHub(token);

  const mapping = await loadNameMappingConfig(githubClient, configPath);
  const slackIds = githubUsernames
    .filter(githubUsername => mapping[githubUsername] !== undefined)
    .map(githubUsername => mapping[githubUsername]);

  return slackIds;
};

const execPrReviewRequestedMention = async (payload: WebhookPayload) => {
  const requestedGithubUsername = payload.requested_reviewer.login;
  const slackIds = await convertToSlackUsername([requestedGithubUsername]);

  if (slackIds.length === 0) {
    return;
  }

  const title = payload.pull_request?.title;
  const url = payload.pull_request?.html_url;
  const requestedSlackUserId = slackIds[0];
  const requestUsername = payload.sender?.login;

  const message = `<@${requestedSlackUserId}> has been requested to review <${url}|${title}> by ${requestUsername}.`;

  const slackWebhookUrl = core.getInput("slack-webhook-url", {
    required: true
  });

  if (!slackWebhookUrl) {
    core.setFailed("Error! Need to set `slack-webhook-url` .");
    return;
  }

  await postToSlack(slackWebhookUrl, message);
};

const main = async () => {
  try {
    if (github.context.payload.action === "review_requested") {
      await execPrReviewRequestedMention(github.context.payload);
      return;
    }

    const info = pickupInfoFromGithubPayload(github.context.payload);

    const githubUsernames = pickupUsername(info.body);
    if (githubUsernames.length === 0) {
      return;
    }

    const slackIds = await convertToSlackUsername(githubUsernames);

    const message = buildSlackPostMessage(
      slackIds,
      info.title,
      info.url,
      info.body
    );

    const slackWebhookUrl = core.getInput("slack-webhook-url", {
      required: true
    });

    if (!slackWebhookUrl) {
      core.setFailed("Error! Need to set `slack-webhook-url` .");
      return;
    }

    await postToSlack(slackWebhookUrl, message);
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
