import * as core from "@actions/core";
import * as github from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";

import {
  pickupUsername,
  pickupInfoFromGithubPayload,
  loadNameMappingConfig
} from "./modules/github";
import { postToSlack, buildSlackPostMessage } from "./modules/slack";

type AllInputs = {
  repoToken: string;
  configurationPath: string;
  slackWebHookUrl: string;
  iconUrl?: string;
  botName?: string;
};

const convertToSlackUsername = async (
  githubUsernames: string[],
  repoToken: string,
  configurationPath: string
) => {
  const githubClient = new github.GitHub(repoToken);
  const mapping = await loadNameMappingConfig(githubClient, configurationPath);
  const slackIds = githubUsernames
    .filter(githubUsername => mapping[githubUsername] !== undefined)
    .map(githubUsername => mapping[githubUsername]);

  return slackIds;
};

const execPrReviewRequestedMention = async (
  payload: WebhookPayload,
  allInputs: AllInputs
) => {
  const { repoToken, configurationPath } = allInputs;
  const requestedGithubUsername = payload.requested_reviewer.login;
  const slackIds = await convertToSlackUsername(
    [requestedGithubUsername],
    repoToken,
    configurationPath
  );

  if (slackIds.length === 0) {
    return;
  }

  const title = payload.pull_request?.title;
  const url = payload.pull_request?.html_url;
  const requestedSlackUserId = slackIds[0];
  const requestUsername = payload.sender?.login;

  const message = `<@${requestedSlackUserId}> has been requested to review <${url}|${title}> by ${requestUsername}.`;
  const { slackWebHookUrl, iconUrl, botName } = allInputs;

  await postToSlack(slackWebHookUrl, message, { iconUrl, botName });
};

const execNormalMention = async (
  payload: WebhookPayload,
  allInputs: AllInputs
) => {
  const info = pickupInfoFromGithubPayload(payload);

  const githubUsernames = pickupUsername(info.body);
  if (githubUsernames.length === 0) {
    return;
  }

  const { repoToken, configurationPath } = allInputs;
  const slackIds = await convertToSlackUsername(
    githubUsernames,
    repoToken,
    configurationPath
  );

  const message = buildSlackPostMessage(
    slackIds,
    info.title,
    info.url,
    info.body
  );

  const { slackWebHookUrl, iconUrl, botName } = allInputs;

  await postToSlack(slackWebHookUrl, message, { iconUrl, botName });
};

const getAllInputs = (): AllInputs => {
  const slackWebHookUrl = core.getInput("slack-webhook-url", {
    required: true
  });

  if (!slackWebHookUrl) {
    core.setFailed("Error! Need to set `slack-webhook-url` .");
  }

  const iconUrl = core.getInput("icon-url", { required: false });
  const botName = core.getInput("bot-name", { required: false });
  const repoToken = core.getInput("repo-token", { required: true });
  const configurationPath = core.getInput("configuration-path", {
    required: true
  });

  return {
    repoToken,
    configurationPath,
    slackWebHookUrl,
    iconUrl,
    botName
  };
};

const main = async () => {
  const allInputs = getAllInputs();
  const { payload } = github.context;

  try {
    if (github.context.payload.action === "review_requested") {
      await execPrReviewRequestedMention(payload, allInputs);
      return;
    }

    await execNormalMention(payload, allInputs);
  } catch (error) {
    core.setFailed(error.message);
  }
};

main();
