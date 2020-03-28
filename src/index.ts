import * as core from "@actions/core";
import * as github from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";
import * as yaml from "js-yaml";
import axios from "axios";

import { pickupUsername, pickupInfoFromGithubPayload } from "./modules/github";

const buildSlackPostMessage = (
  slackIdsForMention: string[],
  issueTitle: string,
  commentLink: string,
  githubBody: string
) => {
  const mentionBlock = slackIdsForMention.map(id => `<@${id}>`).join(" ");
  const body = githubBody
    .split("\n")
    .map(line => `> ${line}`)
    .join("\n");

  return [
    `${mentionBlock} mentioned at <${commentLink}|${issueTitle}>`,
    body
  ].join("\n");
};

type SlackOption = {
  text: string;
  link_names: 0 | 1;
  username: string;
  icon_url?: string;
  icon_emoji?: string;
};

const postToSlack = async (webhookUrl: string, message: string) => {
  const botName = (() => {
    const n = core.getInput("bot-name", { required: false });
    if (n && n !== "") {
      return n;
    }
    return "Github Mention To Slack";
  })();

  const slackOption: SlackOption = {
    text: message,
    link_names: 0,
    username: botName
  };

  const iconUrl = core.getInput("icon-url", { required: false });
  if (iconUrl && iconUrl !== "") {
    slackOption.icon_url = iconUrl;
  } else {
    slackOption.icon_emoji = ":bell:";
  }

  await axios.post(webhookUrl, JSON.stringify(slackOption), {
    headers: { "Content-Type": "application/json" }
  });
};

const loadNameMappingConfig = async (
  client: github.GitHub,
  configurationPath: string
) => {
  const configurationContent = await fetchContent(client, configurationPath);

  const configObject: { [githugUsername: string]: string } = yaml.safeLoad(
    configurationContent
  );
  return configObject;
};

const fetchContent = async (
  client: github.GitHub,
  repoPath: string
): Promise<string> => {
  const response: any = await client.repos.getContents({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    path: repoPath,
    ref: github.context.sha
  });

  return Buffer.from(response.data.content, response.data.encoding).toString();
};

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
