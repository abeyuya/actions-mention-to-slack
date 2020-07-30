import * as core from "@actions/core";
import { context } from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";

import {
  pickupUsername,
  pickupInfoFromGithubPayload,
} from "./modules/github";
import {
  buildTeamsPostMessage,
  buildTeamsErrorMessage,
  TeamsRepositoryImpl,
  TeamsPostParam,
} from "./modules/teams";

export type AllInputs = {
  repoToken: string;
  configurationPath: string;
  slackWebhookUrl: string;
  iconUrl?: string;
  botName?: string;
  runId?: string;
};

// export const convertToSlackUsername = async (
//   githubUsernames: string[],
//   githubClient: typeof GithubRepositoryImpl,
//   repoToken: string,
//   configurationPath: string
// ): Promise<string[]> => {
//   console.log('convertToSlackUsername', githubUsernames, configurationPath);

//   const mapping = await githubClient.loadNameMappingConfig(
//     repoToken,
//     configurationPath
//   );
//   console.log('mapping', mapping)

//   const slackIds = githubUsernames
//     .map((githubUsername) => mapping[githubUsername])
//     .filter((slackId) => slackId !== undefined) as string[];

//   return slackIds;
// };

export const execPrReviewRequestedMention = async (
  payload: WebhookPayload,
  allInputs: AllInputs,
  teamsClient: typeof TeamsRepositoryImpl
) => {
  console.log('execPrReviewRequestedMention', payload);
  const requestedGithubUsername = payload.requested_reviewer.login;
  // const slackIds = await convertToSlackUsername(
  //   [requestedGithubUsername],
  //   githubClient,
  //   repoToken,
  //   configurationPath
  // );

  // if ([requestedGithubUsername].length === 0) {
  //   return;
  // }

  const title = payload.pull_request?.title;
  const url = payload.pull_request?.html_url;
  // const requestedSlackUserId = slackIds[0];
  const requestUsername = payload.sender?.login;

  const message = `You (@${requestedGithubUsername}) has been requested to review [${title}](${url}) by @${requestUsername}.`;
  const { slackWebhookUrl } = allInputs;

  const post: TeamsPostParam = {
    headline: title,
    summary: 'New PR Review Request!',
    message: message,
    mentions: [requestedGithubUsername],
    isAlert: true,
  }

  await teamsClient.postToTeams(slackWebhookUrl, post);
};

export const execNormalMention = async (
  payload: WebhookPayload,
  allInputs: AllInputs,
  slackClient: typeof TeamsRepositoryImpl
) => {
  console.log('execNormalMention');
  const info = pickupInfoFromGithubPayload(payload);

  if (info.body === null) {
    console.error('info.body === null');
    return;
  }

  const githubUsernames = pickupUsername(info.body);
  if (githubUsernames.length === 0) {
    console.error('githubUsernames.length === 0');
    return;
  }

  // const { repoToken, configurationPath } = allInputs;
  // const slackIds = await convertToSlackUsername(
  //   githubUsernames,
  //   githubClient,
  //   repoToken,
  //   configurationPath
  // );

  // if (slackIds.length === 0) {
  //   console.error('slackIds.length === 0');
  //   return;
  // }

  const post = buildTeamsPostMessage(
    githubUsernames,
    info.title,
    info.url,
    info.body,
    info.senderName
  );

  const { slackWebhookUrl } = allInputs;

  await slackClient.postToTeams(slackWebhookUrl, post);
};

const buildCurrentJobUrl = (runId: string) => {
  const { owner, repo } = context.repo;
  return `https://github.com/${owner}/${repo}/runs/${runId}`;
};

export const execPostError = async (
  error: Error,
  allInputs: AllInputs,
  teamsClient: typeof TeamsRepositoryImpl
) => {
  const { runId } = allInputs;
  const currentJobUrl = runId ? buildCurrentJobUrl(runId) : undefined;
  const message = buildTeamsErrorMessage(error, currentJobUrl);

  core.warning(message);

  const { slackWebhookUrl } = allInputs;

  const post: TeamsPostParam =  {
    headline: 'ERROR',
    summary: 'Error!',
    message: message,
    mentions: [],
    isAlert: true,
  }
  

  await teamsClient.postToTeams(slackWebhookUrl, post);
};

const getAllInputs = (): AllInputs => {
  console.log('getAllInputs');

  const slackWebhookUrl = core.getInput("slack-webhook-url", {
    required: true,
  });

  if (!slackWebhookUrl) {
    core.setFailed("Error! Need to set `slack-webhook-url`.");
  }

  const repoToken = core.getInput("repo-token", { required: true });
  if (!repoToken) {
    core.setFailed("Error! Need to set `repo-token`.");
  }

  const iconUrl = core.getInput("icon-url", { required: false });
  const botName = core.getInput("bot-name", { required: false });
  const configurationPath = core.getInput("configuration-path", {
    required: true,
  });
  const runId = core.getInput("run-id", { required: false });

  return {
    repoToken,
    configurationPath,
    slackWebhookUrl,
    iconUrl,
    botName,
    runId,
  };
};

export const main = async () => {
  console.log('Start of run');

  const { payload } = context;
  const allInputs = getAllInputs();

  try {
    if (payload.action === "review_requested") {
      await execPrReviewRequestedMention(
        payload,
        allInputs,
        TeamsRepositoryImpl
      );
      return;
    }

    await execNormalMention(
      payload,
      allInputs,
      TeamsRepositoryImpl
    );
  } catch (error) {
    console.log('Caught error:', error.message);
    await execPostError(error, allInputs, TeamsRepositoryImpl);
  }
};
